/**
 * Service de gestion de l'API Freebox
 */

import * as fs from "fs";
import * as crypto from "crypto";
import { FREEBOX_CONFIG, CACHE_DIR } from "../config";
import { FreeboxConfig, FreeboxApiResponse, FreeboxChannel } from "../models";

/**
 * S'assure que le répertoire de cache existe
 */
function ensureCacheDir(): void {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}

/**
 * Charge la configuration Freebox depuis le fichier
 */
export function loadFreeboxConfig(): FreeboxConfig | null {
    try {
        if (fs.existsSync(FREEBOX_CONFIG.configFile)) {
            return JSON.parse(fs.readFileSync(FREEBOX_CONFIG.configFile, "utf-8"));
        }
    } catch (error) {
        console.error("Erreur lecture config:", error);
    }
    return null;
}

/**
 * Sauvegarde la configuration Freebox
 */
export function saveFreeboxConfig(config: FreeboxConfig): void {
    ensureCacheDir();
    fs.writeFileSync(FREEBOX_CONFIG.configFile, JSON.stringify(config, null, 2));
}

/**
 * Génère le HMAC-SHA1 pour l'authentification
 */
export function computeHmac(challenge: string, appToken: string): string {
    return crypto.createHmac("sha1", appToken).update(challenge).digest("hex");
}

/**
 * Appel générique à l'API Freebox
 */
export async function freeboxApi(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: any,
    sessionToken?: string
): Promise<FreeboxApiResponse> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (sessionToken) {
        headers["X-Fbx-App-Auth"] = sessionToken;
    }

    const response = await fetch(`${FREEBOX_CONFIG.apiUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    return await response.json() as FreeboxApiResponse;
}

/**
 * Ouvre une session Freebox
 */
export async function openFreeboxSession(): Promise<string | null> {
    const config = loadFreeboxConfig();
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
            app_id: FREEBOX_CONFIG.appId,
            password,
        });

        if (sessionResponse.success) {
            config.sessionToken = sessionResponse.result.session_token;
            saveFreeboxConfig(config);
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

/**
 * Recherche une chaîne par son nom
 */
export function findChannelByName(channels: FreeboxChannel[], channelName: string): FreeboxChannel | undefined {
    return channels.find((ch) =>
        ch.name.toLowerCase().includes(channelName.toLowerCase().replace(".fr", "")) ||
        channelName.toLowerCase().includes(ch.name.toLowerCase())
    );
}

