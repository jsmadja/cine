/**
 * Service de gestion du cache
 */

import * as fs from "fs";
import * as path from "path";
import { XMLTV_CONFIG, CACHE_DIR } from "../config";
import { ParsedProgram, CacheData } from "../models";

/**
 * S'assure que le répertoire de cache existe
 */
export function ensureCacheDir(): void {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}

/**
 * Vérifie si le cache des programmes existe et est encore valide
 */
export function isProgramsCacheValid(): boolean {
    try {
        if (!fs.existsSync(XMLTV_CONFIG.cacheFile)) {
            return false;
        }
        const cacheContent = fs.readFileSync(XMLTV_CONFIG.cacheFile, "utf-8");
        const cache = JSON.parse(cacheContent);
        const now = Date.now();
        return now - cache.timestamp < XMLTV_CONFIG.cacheDurationMs;
    } catch {
        return false;
    }
}

/**
 * Lit les données depuis le cache des programmes
 */
export function readProgramsFromCache(): { channels: Map<string, string>; programs: ParsedProgram[] } | null {
    try {
        const cacheContent = fs.readFileSync(XMLTV_CONFIG.cacheFile, "utf-8");
        const cache: CacheData = JSON.parse(cacheContent);
        console.log(
            `📂 Utilisation du cache (créé le ${new Date(cache.timestamp).toLocaleString("fr-FR")})`
        );
        // Reconstruire les dates et la Map
        const channels = new Map<string, string>(Object.entries(cache.channels));
        const programs = cache.programs.map((p) => ({
            ...p,
            startDate: new Date(p.startDate),
            endDate: new Date(p.endDate),
        }));
        return { channels, programs };
    } catch (error) {
        console.warn("⚠️ Erreur lecture cache:", error);
        return null;
    }
}

/**
 * Sauvegarde les données dans le cache des programmes
 */
export function saveProgramsToCache(channels: Map<string, string>, programs: ParsedProgram[]): void {
    try {
        ensureCacheDir();
        const cache: CacheData = {
            timestamp: Date.now(),
            channels: Object.fromEntries(channels),
            programs: programs,
        };
        fs.writeFileSync(XMLTV_CONFIG.cacheFile, JSON.stringify(cache), "utf-8");
        console.log(`💾 Données sauvegardées dans le cache`);
    } catch (error) {
        console.warn("⚠️ Impossible de sauvegarder le cache:", error);
    }
}

/**
 * Vérifie si le fichier XML est en cache et encore valide
 */
export function isXmlCacheValid(): boolean {
    try {
        if (!fs.existsSync(XMLTV_CONFIG.xmlFile)) {
            return false;
        }
        const stats = fs.statSync(XMLTV_CONFIG.xmlFile);
        const now = Date.now();
        return now - stats.mtimeMs < XMLTV_CONFIG.cacheDurationMs;
    } catch {
        return false;
    }
}

/**
 * Retourne le nombre d'heures restantes de validité du cache XML
 */
export function getXmlCacheRemainingHours(): number {
    const stats = fs.statSync(XMLTV_CONFIG.xmlFile);
    const cacheAge = Date.now() - stats.mtimeMs;
    return Math.round((XMLTV_CONFIG.cacheDurationMs - cacheAge) / 1000 / 60 / 60);
}

