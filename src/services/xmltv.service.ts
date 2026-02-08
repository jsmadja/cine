/**
 * Service de téléchargement et parsing XMLTV
 */

import * as fs from "fs";
import { XMLParser } from "fast-xml-parser";
import AdmZip from "adm-zip";

import { XMLTV_CONFIG } from "../config";
import { XmltvData, ParsedProgram } from "../models";
import { extractText, extractCategories, extractPeople, parseXmltvDate } from "../utils";
import {
    ensureCacheDir,
    isProgramsCacheValid,
    readProgramsFromCache,
    saveProgramsToCache,
    isXmlCacheValid,
    getXmlCacheRemainingHours,
} from "./cache.service";

/**
 * Télécharge le fichier ZIP XMLTV depuis l'URL
 */
async function downloadXmltvZip(): Promise<void> {
    console.log(`🌐 Téléchargement du fichier XMLTV depuis ${XMLTV_CONFIG.url}...`);
    const startTime = Date.now();

    const response = await fetch(XMLTV_CONFIG.url);
    if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const downloadTime = Date.now() - startTime;

    console.log(`   ⏱️  Téléchargement effectué en ${downloadTime}ms`);
    console.log(`   📊 Taille du ZIP: ${(buffer.length / 1024 / 1024).toFixed(2)} Mo`);

    ensureCacheDir();

    // Sauvegarder le ZIP
    fs.writeFileSync(XMLTV_CONFIG.zipFile, buffer);
    console.log(`   💾 ZIP sauvegardé: ${XMLTV_CONFIG.zipFile}`);

    // Extraire le XML
    console.log(`   📦 Extraction du ZIP...`);
    const zip = new AdmZip(XMLTV_CONFIG.zipFile);
    zip.extractAllTo(require("path").dirname(XMLTV_CONFIG.xmlFile), true);
    console.log(`   ✅ Extraction terminée`);

    // Vérifier que le fichier XML existe
    if (!fs.existsSync(XMLTV_CONFIG.xmlFile)) {
        throw new Error(`Le fichier xmltv_fr.xml n'a pas été trouvé dans le ZIP`);
    }
}

/**
 * S'assure que le fichier XMLTV est disponible (télécharge si nécessaire)
 */
async function ensureXmltvFile(): Promise<void> {
    if (isXmlCacheValid()) {
        const hoursRemaining = getXmlCacheRemainingHours();
        console.log(`📂 Fichier XMLTV en cache (valide encore ${hoursRemaining}h)`);
        return;
    }

    await downloadXmltvZip();
}

/**
 * Parse le fichier XMLTV et retourne les chaînes et programmes
 */
export async function parseXmltvFile(): Promise<{ channels: Map<string, string>; programs: ParsedProgram[] }> {
    // Vérifier d'abord le cache des programmes parsés
    if (isProgramsCacheValid()) {
        const cachedData = readProgramsFromCache();
        if (cachedData) {
            return cachedData;
        }
    }

    // S'assurer que le fichier XMLTV est disponible
    await ensureXmltvFile();

    console.log(`📄 Lecture du fichier XMLTV: ${XMLTV_CONFIG.xmlFile}`);
    const startTime = Date.now();

    const xmlContent = fs.readFileSync(XMLTV_CONFIG.xmlFile, "utf-8");
    console.log(`   📊 Taille du fichier: ${(xmlContent.length / 1024 / 1024).toFixed(2)} Mo`);

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
    });

    console.log(`   🔄 Parsing XML...`);
    const data: XmltvData = parser.parse(xmlContent);
    const parseTime = Date.now() - startTime;
    console.log(`   ⏱️  Parsing effectué en ${parseTime}ms`);

    // Créer un dictionnaire des chaînes
    const channels = new Map<string, string>();
    const channelList = Array.isArray(data.tv.channel) ? data.tv.channel : [data.tv.channel];
    for (const channel of channelList) {
        const displayName = typeof channel["display-name"] === "string"
            ? channel["display-name"]
            : channel["display-name"];
        channels.set(channel["@_id"], displayName);
    }
    console.log(`   📺 ${channels.size} chaîne(s) trouvée(s)`);

    // Parser les programmes
    const programmeList = Array.isArray(data.tv.programme) ? data.tv.programme : [data.tv.programme];
    console.log(`   📋 ${programmeList.length} programme(s) à analyser`);

    const programs: ParsedProgram[] = programmeList.map((prog) => ({
        title: extractText(prog.title) || "Sans titre",
        subtitle: extractText(prog["sub-title"]),
        description: extractText(prog.desc),
        channelId: prog["@_channel"],
        channelName: channels.get(prog["@_channel"]) || prog["@_channel"],
        startDate: parseXmltvDate(prog["@_start"]),
        endDate: parseXmltvDate(prog["@_stop"]),
        categories: extractCategories(prog.category),
        icon: prog.icon?.["@_src"],
        year: prog.date,
        country: extractText(prog.country),
        rating: prog.rating?.value,
        directors: extractPeople(prog.credits?.director),
        actors: extractPeople(prog.credits?.actor || prog.credits?.guest),
    }));

    // Sauvegarder dans le cache
    saveProgramsToCache(channels, programs);

    return { channels, programs };
}

