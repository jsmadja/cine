/**
 * Interfaces pour le format XMLTV
 */

export interface XmltvChannel {
    "@_id": string;
    "display-name": string;
    icon?: { "@_src": string };
}

export interface XmltvProgramme {
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

export interface XmltvData {
    tv: {
        channel: XmltvChannel[];
        programme: XmltvProgramme[];
    };
}

