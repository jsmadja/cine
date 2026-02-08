/**
 * Routes de l'API Freebox
 */

import { Router, Request, Response } from "express";
import { FREEBOX_CONFIG } from "../config";
import { FreeboxConfig, PvrRequest, FreeboxChannel } from "../models";
import {
    loadFreeboxConfig,
    saveFreeboxConfig,
    freeboxApi,
    openFreeboxSession,
    findChannelByName,
} from "../services/freebox.service";

const router = Router();

/**
 * POST /authorize - Demander l'autorisation Freebox
 */
router.post("/authorize", async (req: Request, res: Response) => {
    console.log("📱 Demande d'autorisation Freebox...");

    try {
        const authRequest = {
            app_id: FREEBOX_CONFIG.appId,
            app_name: FREEBOX_CONFIG.appName,
            app_version: FREEBOX_CONFIG.appVersion,
            device_name: FREEBOX_CONFIG.deviceName,
        };

        const response = await freeboxApi("/login/authorize/", "POST", authRequest);

        if (response.success) {
            const config: FreeboxConfig = {
                appToken: response.result.app_token,
                trackId: response.result.track_id,
            };
            saveFreeboxConfig(config);

            console.log("✅ Autorisation demandée. Veuillez valider sur l'écran de votre Freebox!");
            res.json({
                success: true,
                message: "Veuillez valider l'autorisation sur l'écran LCD de votre Freebox, puis cliquez sur 'Vérifier'",
                trackId: response.result.track_id,
            });
        } else {
            res.json({ success: false, error: response.msg || "Erreur d'autorisation" });
        }
    } catch (error) {
        console.error("❌ Erreur:", error);
        res.json({ success: false, error: String(error) });
    }
});

/**
 * GET /authorize/status - Vérifier le statut de l'autorisation
 */
router.get("/authorize/status", async (req: Request, res: Response) => {
    const config = loadFreeboxConfig();
    if (!config?.trackId) {
        return res.json({ success: false, error: "Aucune autorisation en cours" });
    }

    try {
        const response = await freeboxApi(`/login/authorize/${config.trackId}`);

        if (response.success) {
            const status = response.result.status;
            console.log(`📊 Statut autorisation: ${status}`);

            const statusMessages: Record<string, { success: boolean; message: string }> = {
                granted: { success: true, message: "Autorisation accordée!" },
                pending: { success: true, message: "En attente de validation sur la Freebox..." },
                denied: { success: false, message: "Autorisation refusée" },
                timeout: { success: false, message: "Délai dépassé, veuillez réessayer" },
            };

            const result = statusMessages[status] || { success: false, message: `Statut: ${status}` };
            res.json({ ...result, status });
        } else {
            res.json({ success: false, error: response.msg });
        }
    } catch (error) {
        res.json({ success: false, error: String(error) });
    }
});

/**
 * GET /status - Vérifier le statut de connexion
 */
router.get("/status", async (req: Request, res: Response) => {
    const config = loadFreeboxConfig();

    if (!config?.appToken) {
        return res.json({
            success: true,
            connected: false,
            message: "Non configuré. Cliquez sur 'Autoriser' pour configurer.",
        });
    }

    try {
        const sessionToken = await openFreeboxSession();
        if (sessionToken) {
            res.json({ success: true, connected: true, message: "Connecté à la Freebox" });
        } else {
            res.json({ success: true, connected: false, message: "Échec de connexion. Vérifiez l'autorisation." });
        }
    } catch (error) {
        res.json({ success: false, connected: false, error: String(error) });
    }
});

/**
 * GET /channels - Récupérer la liste des chaînes
 */
router.get("/channels", async (req: Request, res: Response) => {
    try {
        const sessionToken = await openFreeboxSession();
        if (!sessionToken) {
            return res.json({ success: false, error: "Non connecté" });
        }

        const response = await freeboxApi("/tv/channels/", "GET", undefined, sessionToken);

        if (response.success) {
            res.json({ success: true, channels: response.result });
        } else {
            res.json({ success: false, error: response.msg });
        }
    } catch (error) {
        res.json({ success: false, error: String(error) });
    }
});

/**
 * POST /record - Programmer un enregistrement
 */
router.post("/record", async (req: Request, res: Response) => {
    const pvrRequest: PvrRequest = req.body;

    console.log(`🎬 Demande d'enregistrement: ${pvrRequest.name} sur ${pvrRequest.channelName}`);
    console.log(`   📅 Du ${new Date(pvrRequest.start * 1000).toLocaleString("fr-FR")} au ${new Date(pvrRequest.end * 1000).toLocaleString("fr-FR")}`);

    try {
        const sessionToken = await openFreeboxSession();
        if (!sessionToken) {
            return res.json({ success: false, error: "Non connecté à la Freebox. Veuillez d'abord autoriser l'application." });
        }

        // Récupérer les chaînes
        const channelsResponse = await freeboxApi("/tv/channels/", "GET", undefined, sessionToken);
        if (!channelsResponse.success) {
            return res.json({ success: false, error: "Impossible de récupérer la liste des chaînes" });
        }

        // Trouver la chaîne
        const channels = Object.values(channelsResponse.result) as FreeboxChannel[];
        const channel = findChannelByName(channels, pvrRequest.channelName);

        if (!channel) {
            console.log(`   ⚠️ Chaîne "${pvrRequest.channelName}" non trouvée`);
            return res.json({
                success: false,
                error: `Chaîne "${pvrRequest.channelName}" non trouvée sur la Freebox`,
            });
        }

        console.log(`   📺 Chaîne trouvée: ${channel.name} (uuid: ${channel.uuid})`);

        // Programmer l'enregistrement
        const recordRequest = {
            channel_uuid: channel.uuid,
            start: pvrRequest.start,
            end: pvrRequest.end,
            name: pvrRequest.name,
            margin_before: 5 * 60, // 5 minutes avant
            margin_after: 10 * 60, // 10 minutes après
        };

        const recordResponse = await freeboxApi("/pvr/programmed/", "POST", recordRequest, sessionToken);

        if (recordResponse.success) {
            console.log(`   ✅ Enregistrement programmé!`);
            res.json({
                success: true,
                message: `Enregistrement programmé: ${pvrRequest.name} sur ${channel.name}`,
                recordId: recordResponse.result.id,
            });
        } else {
            console.log(`   ❌ Erreur: ${recordResponse.msg}`);
            res.json({ success: false, error: recordResponse.msg || "Erreur lors de la programmation" });
        }
    } catch (error) {
        console.error("❌ Erreur:", error);
        res.json({ success: false, error: String(error) });
    }
});

/**
 * GET /recordings - Liste des enregistrements programmés
 */
router.get("/recordings", async (req: Request, res: Response) => {
    try {
        const sessionToken = await openFreeboxSession();
        if (!sessionToken) {
            return res.json({ success: false, error: "Non connecté" });
        }

        const response = await freeboxApi("/pvr/programmed/", "GET", undefined, sessionToken);

        if (response.success) {
            res.json({ success: true, recordings: response.result });
        } else {
            res.json({ success: false, error: response.msg });
        }
    } catch (error) {
        res.json({ success: false, error: String(error) });
    }
});

export default router;

