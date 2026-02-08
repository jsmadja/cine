/**
 * Modèles de données pour les programmes TV
 */

export interface ParsedProgram {
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

export interface Movie {
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

export interface CacheData {
    timestamp: number;
    channels: Record<string, string>;
    programs: ParsedProgram[];
}

