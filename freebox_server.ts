/**
 * Serveur local pour communiquer avec l'API Freebox
 * Permet de programmer des enregistrements TV
 *
 * Documentation API Freebox: https://dev.freebox.fr/sdk/os/
 */

import express from "express";
import cors from "cors";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const app = express();
const PORT = 3000;

// Configuration
const CONFIG_FILE = path.join(__dirname, "cache", "freebox_config.json");
const FREEBOX_API_URL = "http://mafreebox.freebox.fr/api/v8";

interface FreeboxConfig {
    appToken: string;
    trackId: number;
    challenge?: string;
    sessionToken?: string;
}

interface PvrRequest {
    channelId: string;
    channelName: string;
    start: number; // timestamp en secondes
    end: number;
    name: string;
}

app.use(cors());
app.use(express.json());

// Charger la configuration
function loadConfig(): FreeboxConfig | null {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
        }
    } catch (error) {
        console.error("Erreur lecture config:", error);
    }
    return null;
}

// Sauvegarder la configuration
function saveConfig(config: FreeboxConfig): void {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Générer le HMAC-SHA1 pour l'authentification
function computeHmac(challenge: string, appToken: string): string {
    return crypto.createHmac("sha1", appToken).update(challenge).digest("hex");
}

// Appel API Freebox générique
async function freeboxApi(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: any,
    sessionToken?: string
): Promise<any> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (sessionToken) {
        headers["X-Fbx-App-Auth"] = sessionToken;
    }

    const response = await fetch(`${FREEBOX_API_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    return response.json();
}

// Étape 1: Demander l'autorisation (à faire une seule fois)
app.post("/api/freebox/authorize", async (req, res) => {
    console.log("📱 Demande d'autorisation Freebox...");

    try {
        const authRequest = {
            app_id: "fr.cine.tvrecorder",
            app_name: "TV Recorder",
            app_version: "1.0.0",
            device_name: "Films TV App",
        };

        const response = await freeboxApi("/login/authorize/", "POST", authRequest);

        if (response.success) {
            const config: FreeboxConfig = {
                appToken: response.result.app_token,
                trackId: response.result.track_id,
            };
            saveConfig(config);

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

// Étape 2: Vérifier le statut de l'autorisation
app.get("/api/freebox/authorize/status", async (req, res) => {
    const config = loadConfig();
    if (!config?.trackId) {
        return res.json({ success: false, error: "Aucune autorisation en cours" });
    }

    try {
        const response = await freeboxApi(`/login/authorize/${config.trackId}`);

        if (response.success) {
            const status = response.result.status;
            console.log(`📊 Statut autorisation: ${status}`);

            if (status === "granted") {
                res.json({ success: true, status: "granted", message: "Autorisation accordée!" });
            } else if (status === "pending") {
                res.json({ success: true, status: "pending", message: "En attente de validation sur la Freebox..." });
            } else if (status === "denied") {
                res.json({ success: false, status: "denied", message: "Autorisation refusée" });
            } else if (status === "timeout") {
                res.json({ success: false, status: "timeout", message: "Délai dépassé, veuillez réessayer" });
            } else {
                res.json({ success: false, status, message: `Statut: ${status}` });
            }
        } else {
            res.json({ success: false, error: response.msg });
        }
    } catch (error) {
        res.json({ success: false, error: String(error) });
    }
});

// Ouvrir une session
async function openSession(): Promise<string | null> {
    const config = loadConfig();
    if (!config?.appToken) {
        console.error("❌ Pas de token d'application");
        return null;
    }

    try {
        // Obtenir le challenge
        const loginResponse = await freeboxApi("/login/");
        if (!loginResponse.success) {
            console.error("❌ Erreur login:", loginResponse.msg);
            return null;
        }

        const challenge = loginResponse.result.challenge;
        const password = computeHmac(challenge, config.appToken);

        // Ouvrir la session
        const sessionResponse = await freeboxApi("/login/session/", "POST", {
            app_id: "fr.cine.tvrecorder",
            password,
        });

        if (sessionResponse.success) {
            config.sessionToken = sessionResponse.result.session_token;
            saveConfig(config);
            return sessionResponse.result.session_token;
        } else {
            console.error("❌ Erreur session:", sessionResponse.msg);
            return null;
        }
    } catch (error) {
        console.error("❌ Erreur:", error);
        return null;
    }
}

// Vérifier le statut de connexion
app.get("/api/freebox/status", async (req, res) => {
    const config = loadConfig();

    if (!config?.appToken) {
        return res.json({
            success: true,
            connected: false,
            message: "Non configuré. Cliquez sur 'Autoriser' pour configurer."
        });
    }

    try {
        const sessionToken = await openSession();
        if (sessionToken) {
            res.json({ success: true, connected: true, message: "Connecté à la Freebox" });
        } else {
            res.json({ success: true, connected: false, message: "Échec de connexion. Vérifiez l'autorisation." });
        }
    } catch (error) {
        res.json({ success: false, connected: false, error: String(error) });
    }
});

// Récupérer la liste des chaînes Freebox
app.get("/api/freebox/channels", async (req, res) => {
    try {
        const sessionToken = await openSession();
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

// Programmer un enregistrement
app.post("/api/freebox/record", async (req, res) => {
    const pvrRequest: PvrRequest = req.body;

    console.log(`🎬 Demande d'enregistrement: ${pvrRequest.name} sur ${pvrRequest.channelName}`);
    console.log(`   📅 Du ${new Date(pvrRequest.start * 1000).toLocaleString("fr-FR")} au ${new Date(pvrRequest.end * 1000).toLocaleString("fr-FR")}`);

    try {
        const sessionToken = await openSession();
        if (!sessionToken) {
            return res.json({ success: false, error: "Non connecté à la Freebox. Veuillez d'abord autoriser l'application." });
        }

        // Chercher la chaîne par son nom
        const channelsResponse = await freeboxApi("/tv/channels/", "GET", undefined, sessionToken);
        if (!channelsResponse.success) {
            return res.json({ success: false, error: "Impossible de récupérer la liste des chaînes" });
        }

        // Trouver la chaîne correspondante
        const channels = Object.values(channelsResponse.result) as any[];
        const channel = channels.find((ch: any) =>
            ch.name.toLowerCase().includes(pvrRequest.channelName.toLowerCase().replace(".fr", "")) ||
            pvrRequest.channelName.toLowerCase().includes(ch.name.toLowerCase())
        );

        if (!channel) {
            console.log(`   ⚠️ Chaîne "${pvrRequest.channelName}" non trouvée`);
            return res.json({
                success: false,
                error: `Chaîne "${pvrRequest.channelName}" non trouvée sur la Freebox`
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
                recordId: recordResponse.result.id
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

// Liste des enregistrements programmés
app.get("/api/freebox/recordings", async (req, res) => {
    try {
        const sessionToken = await openSession();
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

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`
🎬 ====================================
   Serveur Freebox TV Recorder
   ====================================
   
   🌐 URL: http://localhost:${PORT}
   
   📡 Endpoints:
   - POST /api/freebox/authorize     → Demander l'autorisation
   - GET  /api/freebox/authorize/status → Vérifier le statut
   - GET  /api/freebox/status        → Statut de connexion
   - GET  /api/freebox/channels      → Liste des chaînes
   - POST /api/freebox/record        → Programmer un enregistrement
   - GET  /api/freebox/recordings    → Liste des enregistrements
   
   ====================================
`);
});

