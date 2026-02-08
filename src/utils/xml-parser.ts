/**
 * Fonctions utilitaires pour le parsing XML
 */

import { XmltvProgramme } from "../models";

/**
 * Extrait le texte d'un élément XML qui peut être string ou objet avec #text
 */
export function extractText(element: string | { "#text": string } | undefined): string | undefined {
    if (!element) return undefined;
    if (typeof element === "string") return element;
    return element["#text"];
}

/**
 * Extrait les catégories d'un programme
 */
export function extractCategories(category: XmltvProgramme["category"]): string[] {
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
export function extractPeople(people: string | string[] | undefined): string[] {
    if (!people) return [];
    if (typeof people === "string") return [people];
    return people;
}

/**
 * Parse une date XMLTV (format: 20260207063000 +0100)
 */
export function parseXmltvDate(dateStr: string): Date {
    const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/);
    if (!match) {
        console.warn(`   ⚠️  Date invalide: ${dateStr}`);
        return new Date();
    }
    const [, year, month, day, hour, minute, second, tz] = match;
    const isoDate = `${year}-${month}-${day}T${hour}:${minute}:${second}${tz ? tz.slice(0, 3) + ":" + tz.slice(3) : ""}`;
    return new Date(isoDate);
}

