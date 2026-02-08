/**
 * Modèles de données pour l'API Freebox
 */

export interface FreeboxConfig {
    appToken: string;
    trackId: number;
    challenge?: string;
    sessionToken?: string;
}

export interface PvrRequest {
    channelId: string;
    channelName: string;
    start: number; // timestamp en secondes
    end: number;
    name: string;
}

export interface FreeboxApiResponse {
    success: boolean;
    result?: any;
    msg?: string;
}

export interface FreeboxChannel {
    uuid: string;
    name: string;
    [key: string]: any;
}

