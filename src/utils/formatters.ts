/**
 * Fonctions utilitaires pour le formatage
 */

/**
 * Formate une heure en HH:MM
 */
export function formatTime(date: Date): string {
    return date.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

/**
 * Formate une durée en heures et minutes
 */
export function formatDuration(startDate: Date, endDate: Date): string {
    const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    if (hours > 0) {
        return `${hours}h${minutes.toString().padStart(2, "0")}`;
    }
    return `${minutes} min`;
}

/**
 * Échappe les caractères HTML spéciaux
 */
export function escapeHtml(text: unknown): string {
    if (typeof text !== "string") return `${text}`;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

