/**
 * Script pour lister les films qui vont passer sur les chaînes TV françaises
 * Utilise le fichier XMLTV: xmltv_fr.xml
 */

import * as fs from "fs";
import * as path from "path";
import { XMLParser } from "fast-xml-parser";
import AdmZip from "adm-zip";

// Interfaces pour le format XMLTV
interface XmltvChannel {
    "@_id": string;
    "display-name": string;
    icon?: { "@_src": string };
}

interface XmltvProgramme {
    "@_start": string;
    "@_stop": string;
    "@_channel": string;
    title: string | { "#text": string; "@_lang": string };
    "sub-title"?: string | { "#text": string; "@_lang": string };
    desc?: string | { "#text": string; "@_lang": string };
    category?: string | string[] | { "#text": string; "@_lang": string } | { "#text": string; "@_lang": string }[];
    icon?: { "@_src": string };
    date?: string;
    country?: string | { "#text": string; "@_lang": string };
    rating?: {
        "@_system": string;
        value: string;
    };
    credits?: {
        director?: string | string[];
        actor?: string | string[];
        guest?: string | string[];
    };
}

interface XmltvData {
    tv: {
        channel: XmltvChannel[];
        programme: XmltvProgramme[];
    };
}

// Configuration
const XMLTV_URL = "https://xmltvfr.fr/xmltv/xmltv_fr.zip";
const CACHE_DIR = path.join(__dirname, "cache");
const XMLTV_FILE = path.join(CACHE_DIR, "xmltv_fr.xml");
const XMLTV_ZIP_FILE = path.join(CACHE_DIR, "xmltv_fr.zip");
const CACHE_FILE = path.join(CACHE_DIR, "programs_cache.json");
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 heures

// Filtre des chaînes (laisser vide pour inclure toutes les chaînes)
// Exemple: ["RTL9.fr", "TMC.fr"]
const CHANNEL_FILTER: string[] = [
     "RTL9.fr",
     "TMC.fr",
];

interface CacheData {
    timestamp: number;
    channels: Map<string, string>; // id -> display-name
    programs: ParsedProgram[];
}

// Catégories de programmes qui correspondent à des films
const MOVIE_CATEGORIES = [
    "film",
    "cinéma",
    "cinema",
    "téléfilm",
    "telefilm",
    "long métrage",
    "long metrage",
];

interface ParsedProgram {
    title: string;
    subtitle?: string;
    description?: string;
    channelId: string;
    channelName: string;
    startDate: Date;
    endDate: Date;
    categories: string[];
    icon?: string;
    year?: string;
    country?: string;
    rating?: string;
    directors?: string[];
    actors?: string[];
}

interface Movie {
    name: string;
    subtitle?: string;
    channel: string;
    startDate: Date;
    endDate: Date;
    categories: string[];
    description?: string;
    rating?: string;
    icon?: string;
    year?: string;
    country?: string;
    directors?: string[];
    actors?: string[];
}

/**
 * Extrait le texte d'un élément XML qui peut être string ou objet avec #text
 */
function extractText(element: string | { "#text": string } | undefined): string | undefined {
    if (!element) return undefined;
    if (typeof element === "string") return element;
    return element["#text"];
}

/**
 * Extrait les catégories d'un programme
 */
function extractCategories(category: XmltvProgramme["category"]): string[] {
    if (!category) return [];
    if (typeof category === "string") return [category];
    if (Array.isArray(category)) {
        return category.map((c) => (typeof c === "string" ? c : c["#text"]));
    }
    return [category["#text"]];
}

/**
 * Extrait une liste de personnes (directeurs, acteurs)
 */
function extractPeople(people: string | string[] | undefined): string[] {
    if (!people) return [];
    if (typeof people === "string") return [people];
    return people;
}

/**
 * Parse une date XMLTV (format: 20260207063000 +0100)
 */
function parseXmltvDate(dateStr: string): Date {
    // Format: YYYYMMDDHHmmss +ZZZZ
    const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/);
    if (!match) {
        console.warn(`   ⚠️  Date invalide: ${dateStr}`);
        return new Date();
    }
    const [, year, month, day, hour, minute, second, tz] = match;
    const isoDate = `${year}-${month}-${day}T${hour}:${minute}:${second}${tz ? tz.slice(0, 3) + ":" + tz.slice(3) : ""}`;
    return new Date(isoDate);
}

/**
 * Vérifie si le cache existe et est encore valide
 */
function isCacheValid(): boolean {
    try {
        if (!fs.existsSync(CACHE_FILE)) {
            return false;
        }
        const cacheContent = fs.readFileSync(CACHE_FILE, "utf-8");
        const cache = JSON.parse(cacheContent);
        const now = Date.now();
        return now - cache.timestamp < CACHE_DURATION_MS;
    } catch {
        return false;
    }
}

/**
 * Lit les données depuis le cache
 */
function readFromCache(): { channels: Map<string, string>; programs: ParsedProgram[] } | null {
    try {
        const cacheContent = fs.readFileSync(CACHE_FILE, "utf-8");
        const cache = JSON.parse(cacheContent);
        console.log(
            `📂 Utilisation du cache (créé le ${new Date(cache.timestamp).toLocaleString("fr-FR")})`
        );
        // Reconstruire les dates et la Map
        const channels = new Map<string, string>(Object.entries(cache.channels));
        const programs = cache.programs.map((p: any) => ({
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
 * Sauvegarde les données dans le cache
 */
function saveToCache(channels: Map<string, string>, programs: ParsedProgram[]): void {
    try {
        const cache = {
            timestamp: Date.now(),
            channels: Object.fromEntries(channels),
            programs: programs,
        };
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), "utf-8");
        console.log(`💾 Données sauvegardées dans le cache`);
    } catch (error) {
        console.warn("⚠️ Impossible de sauvegarder le cache:", error);
    }
}

/**
 * Vérifie si le fichier XML est en cache et encore valide
 */
function isXmlCacheValid(): boolean {
    try {
        if (!fs.existsSync(XMLTV_FILE)) {
            return false;
        }
        const stats = fs.statSync(XMLTV_FILE);
        const now = Date.now();
        return now - stats.mtimeMs < CACHE_DURATION_MS;
    } catch {
        return false;
    }
}

/**
 * Télécharge le fichier ZIP depuis l'URL
 */
async function downloadXmltvZip(): Promise<void> {
    console.log(`🌐 Téléchargement du fichier XMLTV depuis ${XMLTV_URL}...`);
    const startTime = Date.now();

    const response = await fetch(XMLTV_URL);
    if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const downloadTime = Date.now() - startTime;

    console.log(`   ⏱️  Téléchargement effectué en ${downloadTime}ms`);
    console.log(`   📊 Taille du ZIP: ${(buffer.length / 1024 / 1024).toFixed(2)} Mo`);

    // Créer le répertoire de cache s'il n'existe pas
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    // Sauvegarder le ZIP
    fs.writeFileSync(XMLTV_ZIP_FILE, buffer);
    console.log(`   💾 ZIP sauvegardé: ${XMLTV_ZIP_FILE}`);

    // Extraire le XML
    console.log(`   📦 Extraction du ZIP...`);
    const zip = new AdmZip(XMLTV_ZIP_FILE);
    zip.extractAllTo(CACHE_DIR, true);
    console.log(`   ✅ Extraction terminée`);

    // Vérifier que le fichier XML existe
    if (!fs.existsSync(XMLTV_FILE)) {
        throw new Error(`Le fichier xmltv_fr.xml n'a pas été trouvé dans le ZIP`);
    }
}

/**
 * S'assure que le fichier XMLTV est disponible (télécharge si nécessaire)
 */
async function ensureXmltvFile(): Promise<void> {
    if (isXmlCacheValid()) {
        const stats = fs.statSync(XMLTV_FILE);
        const cacheAge = Date.now() - stats.mtimeMs;
        const hoursRemaining = Math.round((CACHE_DURATION_MS - cacheAge) / 1000 / 60 / 60);
        console.log(`📂 Fichier XMLTV en cache (valide encore ${hoursRemaining}h)`);
        return;
    }

    await downloadXmltvZip();
}

/**
 * Parse le fichier XMLTV
 */
async function parseXmltvFile(): Promise<{ channels: Map<string, string>; programs: ParsedProgram[] }> {
    // Vérifier d'abord le cache des programmes parsés
    if (isCacheValid()) {
        const cachedData = readFromCache();
        if (cachedData) {
            return cachedData;
        }
    }

    // S'assurer que le fichier XMLTV est disponible
    await ensureXmltvFile();

    console.log(`📄 Lecture du fichier XMLTV: ${XMLTV_FILE}`);
    const startTime = Date.now();


    const xmlContent = fs.readFileSync(XMLTV_FILE, "utf-8");
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
    saveToCache(channels, programs);

    return { channels, programs };
}

function isMovie(program: ParsedProgram): boolean {
    const categories = program.categories.map((c) => c.toLowerCase());
    return categories.some((cat) =>
        MOVIE_CATEGORIES.some((movieCat) => cat.includes(movieCat))
    );
}

function formatDate(date: Date): string {
    return date.toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

function formatTime(date: Date): string {
    return date.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatDuration(startDate: Date, endDate: Date): string {
    const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    if (hours > 0) {
        return `${hours}h${minutes.toString().padStart(2, "0")}`;
    }
    return `${minutes} min`;
}

async function main() {
    console.log("🎬 Analyse des programmes TV...\n");

    try {
        const { channels, programs } = await parseXmltvFile();
        const movies: Movie[] = [];

        // Stats pour les logs
        const categoryStats = new Map<string, number>();
        const channelStats = new Map<string, { total: number; movies: number }>();

        // Filtrer les programmes par chaîne si un filtre est défini
        const filteredPrograms = CHANNEL_FILTER.length > 0
            ? programs.filter((p) => CHANNEL_FILTER.includes(p.channelId))
            : programs;

        // Afficher le filtre actif
        if (CHANNEL_FILTER.length > 0) {
            console.log(`🔍 Filtre de chaînes actif: ${CHANNEL_FILTER.join(", ")}`);
            console.log(`   📋 ${filteredPrograms.length} programme(s) après filtrage (sur ${programs.length} total)\n`);
        }

        console.log("\n📊 Filtrage des films...\n");

        // Parcourir tous les programmes filtrés
        for (const program of filteredPrograms) {
            // Initialiser les stats de la chaîne
            if (!channelStats.has(program.channelName)) {
                channelStats.set(program.channelName, { total: 0, movies: 0 });
            }
            const stats = channelStats.get(program.channelName)!;
            stats.total++;

            // Compter les catégories
            for (const cat of program.categories) {
                categoryStats.set(cat, (categoryStats.get(cat) ?? 0) + 1);
            }

            if (isMovie(program)) {
                stats.movies++;
                movies.push({
                    name: program.title,
                    subtitle: program.subtitle,
                    channel: program.channelName,
                    startDate: program.startDate,
                    endDate: program.endDate,
                    categories: program.categories,
                    description: program.description,
                    rating: program.rating,
                    icon: program.icon,
                    year: program.year,
                    country: program.country,
                    directors: program.directors,
                    actors: program.actors,
                });
            }
        }

        // Afficher les statistiques
        console.log("=".repeat(80));
        console.log("📈 STATISTIQUES DE FILTRAGE");
        console.log("=".repeat(80));
        if (CHANNEL_FILTER.length > 0) {
            console.log(`\n🔍 Chaînes filtrées: ${CHANNEL_FILTER.length} (${CHANNEL_FILTER.join(", ")})`);
        }
        console.log(`📺 Chaînes analysées: ${channelStats.size}${CHANNEL_FILTER.length === 0 ? ` (toutes les ${channels.size} chaînes)` : ""}`);
        console.log(`📋 Programmes analysés: ${filteredPrograms.length}${CHANNEL_FILTER.length > 0 ? ` (sur ${programs.length} total)` : ""}`);
        console.log(`🎬 Films trouvés: ${movies.length}`);
        if (filteredPrograms.length > 0) {
            console.log(`📊 Taux de filtrage: ${((movies.length / filteredPrograms.length) * 100).toFixed(2)}%`);
        }

        // Top 20 des catégories
        console.log("\n🏷️  Top 20 des catégories de programmes:");
        const sortedCategories = [...categoryStats.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20);
        for (const [cat, count] of sortedCategories) {
            const isMovieCat = MOVIE_CATEGORIES.some((movieCat) =>
                cat.toLowerCase().includes(movieCat)
            );
            const marker = isMovieCat ? "🎬" : "  ";
            console.log(`   ${marker} ${cat}: ${count} programme(s)`);
        }

        // Top 10 chaînes avec le plus de films
        console.log("\n📺 Top 10 des chaînes avec le plus de films:");
        const sortedChannels = [...channelStats.entries()]
            .sort((a, b) => b[1].movies - a[1].movies)
            .filter(([, stats]) => stats.movies > 0)
            .slice(0, 10);
        for (const [channel, stats] of sortedChannels) {
            console.log(`   🎬 ${channel}: ${stats.movies} film(s) / ${stats.total} programmes`);
        }

        console.log("\n" + "=".repeat(80));

        // Trier les films par date de début
        movies.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

        if (movies.length === 0) {
            console.log("Aucun film trouvé dans les programmes à venir.");
            return;
        }

        console.log(`\n🎬 LISTE DES ${movies.length} FILM(S) :\n`);
        console.log("=".repeat(80));

        // Grouper les films par jour
        const moviesByDay = new Map<string, Movie[]>();
        for (const movie of movies) {
            const dayKey = formatDate(movie.startDate);
            if (!moviesByDay.has(dayKey)) {
                moviesByDay.set(dayKey, []);
            }
            moviesByDay.get(dayKey)!.push(movie);
        }

        // Afficher les films par jour
        for (const [day, dayMovies] of moviesByDay) {
            console.log(`\n📅 ${day} (${dayMovies.length} film(s))`);
            console.log("-".repeat(80));

            for (const movie of dayMovies) {
                const startTime = formatTime(movie.startDate);
                const endTime = formatTime(movie.endDate);
                const duration = formatDuration(movie.startDate, movie.endDate);

                console.log(`\n🎬 ${movie.name}${movie.year ? ` (${movie.year})` : ""}`);
                if (movie.subtitle) {
                    console.log(`   📌 ${movie.subtitle}`);
                }
                console.log(`   📺 ${movie.channel}`);
                console.log(`   🕐 ${startTime} - ${endTime} (${duration})`);
                console.log(`   🏷️  ${movie.categories.join(", ")}`);
                if (movie.country) {
                    console.log(`   🌍 ${movie.country}`);
                }
                if (movie.rating) {
                    console.log(`   👥 ${movie.rating}`);
                }
                if (movie.directors && movie.directors.length > 0) {
                    console.log(`   🎬 Réalisateur(s): ${movie.directors.join(", ")}`);
                }
                if (movie.actors && movie.actors.length > 0) {
                    console.log(`   🎭 Avec: ${movie.actors.slice(0, 5).join(", ")}${movie.actors.length > 5 ? "..." : ""}`);
                }
                if (movie.description) {
                    const maxDescLength = 200;
                    const desc =
                        movie.description.length > maxDescLength
                            ? movie.description.substring(0, maxDescLength) + "..."
                            : movie.description;
                    console.log(`   📝 ${desc}`);
                }
            }
        }

        console.log("\n" + "=".repeat(80));
        console.log(`\n✅ Total: ${movies.length} film(s) sur ${moviesByDay.size} jour(s)`);

        // Générer la page HTML
        generateHtmlPage(movies, moviesByDay);
    } catch (error) {
        console.error("❌ Erreur:", error);
        process.exit(1);
    }
}

/**
 * Génère une page HTML avec les films organisés par jour et par chaîne
 */
function generateHtmlPage(movies: Movie[], moviesByDay: Map<string, Movie[]>): void {
    const htmlFile = path.join(CACHE_DIR, "films.html");

    // Organiser les films par jour puis par chaîne
    const moviesByDayAndChannel = new Map<string, Map<string, Movie[]>>();
    for (const [day, dayMovies] of moviesByDay) {
        const byChannel = new Map<string, Movie[]>();
        for (const movie of dayMovies) {
            if (!byChannel.has(movie.channel)) {
                byChannel.set(movie.channel, []);
            }
            byChannel.get(movie.channel)!.push(movie);
        }
        // Trier les chaînes par nombre de films décroissant
        const sortedByChannel = new Map([...byChannel.entries()].sort((a, b) => b[1].length - a[1].length));
        moviesByDayAndChannel.set(day, sortedByChannel);
    }

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📺 Films TV - Programme</title>
    <style>
        :root {
            --bg-primary: #0f0f0f;
            --bg-secondary: #1a1a1a;
            --bg-card: #252525;
            --bg-hover: #303030;
            --text-primary: #ffffff;
            --text-secondary: #a0a0a0;
            --accent: #e50914;
            --accent-hover: #f40612;
            --border: #333;
            --gradient-start: #e50914;
            --gradient-end: #b20710;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            min-height: 100vh;
        }
        
        header {
            background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
            padding: 2rem;
            text-align: center;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        
        header h1 {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .stats {
            display: flex;
            justify-content: center;
            gap: 2rem;
            margin-top: 1rem;
            flex-wrap: wrap;
        }
        
        .stat {
            background: rgba(255,255,255,0.15);
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.9rem;
        }
        
        main {
            max-width: 1400px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .day-section {
            margin-bottom: 3rem;
        }
        
        .day-header {
            background: var(--bg-secondary);
            padding: 1rem 1.5rem;
            border-radius: 12px;
            margin-bottom: 1.5rem;
            border-left: 4px solid var(--accent);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
        }
        
        .day-header h2 {
            font-size: 1.5rem;
            font-weight: 600;
            text-transform: capitalize;
        }
        
        .day-count {
            background: var(--accent);
            padding: 0.3rem 0.8rem;
            border-radius: 15px;
            font-size: 0.85rem;
            font-weight: 600;
        }
        
        .channel-section {
            margin-bottom: 2rem;
            margin-left: 1rem;
        }
        
        .channel-header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid var(--border);
        }
        
        .channel-header h3 {
            font-size: 1.2rem;
            font-weight: 500;
            color: var(--text-secondary);
        }
        
        .channel-count {
            background: var(--bg-hover);
            padding: 0.2rem 0.6rem;
            border-radius: 10px;
            font-size: 0.75rem;
            color: var(--text-secondary);
        }
        
        .movies-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 1.25rem;
        }
        
        .movie-card {
            background: var(--bg-card);
            border-radius: 12px;
            overflow: hidden;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            border: 1px solid var(--border);
        }
        
        .movie-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.4);
            border-color: var(--accent);
        }
        
        .movie-poster {
            width: 100%;
            height: 180px;
            object-fit: cover;
            background: var(--bg-hover);
        }
        
        .movie-poster.placeholder {
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 4rem;
            color: var(--text-secondary);
        }
        
        .movie-content {
            padding: 1rem;
        }
        
        .movie-title {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 0.25rem;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        
        .movie-year {
            color: var(--accent);
            font-weight: 500;
        }
        
        .movie-subtitle {
            font-size: 0.85rem;
            color: var(--text-secondary);
            margin-bottom: 0.5rem;
            font-style: italic;
        }
        
        .movie-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-bottom: 0.75rem;
        }
        
        .movie-time {
            background: var(--accent);
            color: white;
            padding: 0.25rem 0.6rem;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 600;
        }
        
        .movie-duration {
            background: var(--bg-hover);
            padding: 0.25rem 0.6rem;
            border-radius: 6px;
            font-size: 0.8rem;
            color: var(--text-secondary);
        }
        
        .movie-rating {
            background: #2d5a27;
            padding: 0.25rem 0.6rem;
            border-radius: 6px;
            font-size: 0.8rem;
        }
        
        .movie-categories {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
            margin-bottom: 0.75rem;
        }
        
        .category-tag {
            background: var(--bg-hover);
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-size: 0.7rem;
            color: var(--text-secondary);
        }
        
        .movie-info {
            font-size: 0.85rem;
            color: var(--text-secondary);
            margin-bottom: 0.5rem;
        }
        
        .movie-info strong {
            color: var(--text-primary);
        }
        
        .movie-description {
            font-size: 0.85rem;
            color: var(--text-secondary);
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
            line-height: 1.5;
        }
        
        footer {
            text-align: center;
            padding: 2rem;
            color: var(--text-secondary);
            font-size: 0.85rem;
            border-top: 1px solid var(--border);
            margin-top: 2rem;
        }
        
        @media (max-width: 768px) {
            header h1 {
                font-size: 1.8rem;
            }
            
            main {
                padding: 1rem;
            }
            
            .movies-grid {
                grid-template-columns: 1fr;
            }
            
            .stats {
                gap: 0.75rem;
            }
            
            .stat {
                font-size: 0.8rem;
                padding: 0.4rem 0.8rem;
            }
        }
    </style>
</head>
<body>
    <header>
        <h1>🎬 Films TV</h1>
        <p>Programme des films sur les chaînes françaises</p>
        <div class="stats">
            <span class="stat">📺 ${movies.length} film(s)</span>
            <span class="stat">📅 ${moviesByDay.size} jour(s)</span>
            <span class="stat">🔄 Mis à jour le ${new Date().toLocaleString("fr-FR")}</span>
        </div>
    </header>
    
    <main>
        ${[...moviesByDayAndChannel.entries()].map(([day, channelMovies]) => `
        <section class="day-section">
            <div class="day-header">
                <h2>📅 ${day}</h2>
                <span class="day-count">${[...channelMovies.values()].reduce((sum, m) => sum + m.length, 0)} film(s)</span>
            </div>
            
            ${[...channelMovies.entries()].map(([channel, channelMovieList]) => `
            <div class="channel-section">
                <div class="channel-header">
                    <h3>📺 ${channel}</h3>
                    <span class="channel-count">${channelMovieList.length} film(s)</span>
                </div>
                
                <div class="movies-grid">
                    ${channelMovieList.map(movie => `
                    <article class="movie-card">
                        ${movie.icon 
                            ? `<img class="movie-poster" src="${movie.icon}" alt="${escapeHtml(movie.name)}" loading="lazy" onerror="this.outerHTML='<div class=\\'movie-poster placeholder\\'>🎬</div>'">`
                            : `<div class="movie-poster placeholder">🎬</div>`
                        }
                        <div class="movie-content">
                            <h4 class="movie-title">
                                ${escapeHtml(movie.name)}
                                ${movie.year ? `<span class="movie-year">(${movie.year})</span>` : ""}
                            </h4>
                            ${movie.subtitle ? `<p class="movie-subtitle">${escapeHtml(movie.subtitle)}</p>` : ""}
                            
                            <div class="movie-meta">
                                <span class="movie-time">🕐 ${formatTime(movie.startDate)}</span>
                                <span class="movie-duration">${formatDuration(movie.startDate, movie.endDate)}</span>
                                ${movie.rating ? `<span class="movie-rating">👥 ${escapeHtml(movie.rating)}</span>` : ""}
                            </div>
                            
                            <div class="movie-categories">
                                ${movie.categories.map(cat => `<span class="category-tag">${escapeHtml(cat)}</span>`).join("")}
                            </div>
                            
                            ${movie.country ? `<p class="movie-info">🌍 ${escapeHtml(movie.country)}</p>` : ""}
                            ${movie.directors && movie.directors.length > 0 ? `<p class="movie-info"><strong>Réalisateur:</strong> ${escapeHtml(movie.directors.join(", "))}</p>` : ""}
                            ${movie.actors && movie.actors.length > 0 ? `<p class="movie-info"><strong>Avec:</strong> ${escapeHtml(movie.actors.slice(0, 4).join(", "))}${movie.actors.length > 4 ? "..." : ""}</p>` : ""}
                            ${movie.description ? `<p class="movie-description">${escapeHtml(movie.description)}</p>` : ""}
                        </div>
                    </article>
                    `).join("")}
                </div>
            </div>
            `).join("")}
        </section>
        `).join("")}
    </main>
    
    <footer>
        <p>Généré automatiquement à partir des données XMLTV • ${new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
    </footer>
</body>
</html>`;

    fs.writeFileSync(htmlFile, html, "utf-8");
    console.log(`\n🌐 Page HTML générée: ${htmlFile}`);
}

/**
 * Échappe les caractères HTML spéciaux
 */
function escapeHtml(text: unknown): string {
    // if text is string
    if (typeof text !== "string") return `${text}`;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

main();
