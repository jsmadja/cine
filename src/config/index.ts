/**
 * Configuration de l'application
 */

import * as path from "path";

// Répertoire de base pour le cache
export const CACHE_DIR = path.join(__dirname, "..", "..", "cache");

// Configuration XMLTV
export const XMLTV_CONFIG = {
    url: "https://xmltvfr.fr/xmltv/xmltv_fr.zip",
    xmlFile: path.join(CACHE_DIR, "xmltv_fr.xml"),
    zipFile: path.join(CACHE_DIR, "xmltv_fr.zip"),
    cacheFile: path.join(CACHE_DIR, "programs_cache.json"),
    cacheDurationMs: 24 * 60 * 60 * 1000, // 24 heures
};

// Configuration Freebox
export const FREEBOX_CONFIG = {
    apiUrl: "http://mafreebox.freebox.fr/api/v8",
    configFile: path.join(CACHE_DIR, "freebox_config.json"),
    appId: "fr.cine.tvrecorder",
    appName: "TV Recorder",
    appVersion: "1.0.0",
    deviceName: "Films TV App",
};

// Configuration du serveur
export const SERVER_CONFIG = {
    port: 3000,
};

// Filtre des chaînes (laisser vide pour inclure toutes les chaînes)
export const CHANNEL_FILTER: string[] = [
    "RTL9.fr",
    "TMC.fr",
    "Arte.fr",
    "France2.fr",
    "France3.fr",
    "France4.fr",
    "France5.fr",
    "W9.fr",
    "TF1.fr"
];

// Catégories de programmes qui correspondent à des films
export const MOVIE_CATEGORIES = [
    "film",
    "cinéma",
    "cinema",
    "long métrage",
    "long metrage",
];

// Catégories à exclure (même si elles contiennent "film")
export const EXCLUDED_CATEGORIES = [
    "téléfilm",
    "telefilm",
];

// Configuration de la page HTML générée
export const HTML_CONFIG = {
    outputFile: path.join(CACHE_DIR, "films.html"),
    apiUrl: "http://localhost:3000/api/freebox",
};

