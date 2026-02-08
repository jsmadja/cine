import {Injectable, Logger} from '@nestjs/common';
import {Cron, CronExpression} from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import {XMLParser} from 'fast-xml-parser';
import AdmZip from 'adm-zip';
import {Channel, Movie, MoviesResponse} from './movie.interface';
import {FreeboxService} from '../freebox/freebox.service';

// Configuration
const XMLTV_URL = 'https://xmltvfr.fr/xmltv/xmltv_fr.zip';
const CACHE_DIR = path.join(process.cwd(), 'cache');
const XMLTV_FILE = path.join(CACHE_DIR, 'xmltv_fr.xml');
const XMLTV_ZIP_FILE = path.join(CACHE_DIR, 'xmltv_fr.zip');
const MOVIES_CACHE_FILE = path.join(CACHE_DIR, 'movies_cache.json');
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 heures

// Catégories de films
const EXCLUDED_CATEGORIES = ['téléfilm', 'telefilm', 'Clips', 'clips', 'culture infos', 'autre', 'football', 'doc animalier', 'doc sciences', 'série policière', 'sport', 'magazine'];
const MIN_MOVIE_DURATION_MINUTES = 60; // Durée minimale d'un film en minutes

// Chaînes par défaut (modifiable)
const DEFAULT_CHANNEL_FILTER: string[] = [];

interface XmltvProgramme {
    '@_start': string;
    '@_stop': string;
    '@_channel': string;
    title: string | { '#text': string };
    'sub-title'?: string | { '#text': string };
    desc?: string | { '#text': string };
    category?: string | string[] | { '#text': string } | { '#text': string }[];
    icon?: { '@_src': string };
    date?: string;
    country?: string | { '#text': string };
    rating?: { value: string };
    credits?: {
        director?: string | string[];
        actor?: string | string[];
        guest?: string | string[];
    };
}

@Injectable()
export class MoviesService {
    private readonly logger = new Logger(MoviesService.name);
    private movies: Movie[] = [];
    private channels: Channel[] = [];
    private lastUpdated: Date = new Date(0);
    private channelFilter: string[] = DEFAULT_CHANNEL_FILTER;

    constructor(private readonly freeboxService: FreeboxService) {
        this.ensureCacheDir();
        this.loadFromCache();
    }

    private ensureCacheDir(): void {
        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, {recursive: true});
        }
    }

    private loadFromCache(): void {
        try {
            if (fs.existsSync(MOVIES_CACHE_FILE)) {
                const data = JSON.parse(fs.readFileSync(MOVIES_CACHE_FILE, 'utf-8'));
                const cacheAge = Date.now() - new Date(data.lastUpdated).getTime();

                if (cacheAge < CACHE_DURATION_MS) {
                    this.movies = data.movies.map((m: any) => ({
                        ...m,
                        startDate: new Date(m.startDate),
                        endDate: new Date(m.endDate),
                    }));
                    this.channels = data.channels;
                    this.lastUpdated = new Date(data.lastUpdated);
                    this.logger.log(`📂 Cache chargé: ${this.movies.length} films`);
                    return;
                }
            }
        } catch (error) {
            this.logger.warn('Erreur lecture cache:', error);
        }

        // Pas de cache valide, charger les données
        this.refreshMovies();
    }

    private saveToCache(): void {
        try {
            const data = {
                movies: this.movies,
                channels: this.channels,
                lastUpdated: this.lastUpdated,
            };
            fs.writeFileSync(MOVIES_CACHE_FILE, JSON.stringify(data), 'utf-8');
            this.logger.log('💾 Cache sauvegardé');
        } catch (error) {
            this.logger.error('Erreur sauvegarde cache:', error);
        }
    }

    // Rafraîchir les films tous les jours à 6h du matin
    @Cron(CronExpression.EVERY_DAY_AT_6AM)
    async scheduledRefresh(): Promise<void> {
        this.logger.log('⏰ Rafraîchissement programmé des films...');
        await this.refreshMovies();
    }

    async refreshMovies(): Promise<void> {
        this.logger.log('🔄 Rafraîchissement des films...');

        try {
            await this.downloadXmltvFile();
            await this.parseXmltvFile();
            this.lastUpdated = new Date();
            this.saveToCache();
            this.logger.log(`✅ ${this.movies.length} films chargés`);
        } catch (error) {
            this.logger.error('❌ Erreur rafraîchissement:', error);
            throw error;
        }
    }

    private async downloadXmltvFile(): Promise<void> {
        // Vérifier si le fichier XML est en cache
        if (fs.existsSync(XMLTV_FILE)) {
            const stats = fs.statSync(XMLTV_FILE);
            const fileAge = Date.now() - stats.mtimeMs;
            if (fileAge < CACHE_DURATION_MS) {
                const hoursRemaining = Math.round((CACHE_DURATION_MS - fileAge) / 1000 / 60 / 60);
                this.logger.log(`📂 Fichier XMLTV en cache (valide encore ${hoursRemaining}h)`);
                return;
            }
        }

        this.logger.log(`🌐 Téléchargement XMLTV depuis ${XMLTV_URL}...`);
        const startTime = Date.now();

        const response = await fetch(XMLTV_URL);
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const downloadTime = Date.now() - startTime;

        this.logger.log(`⏱️ Téléchargement en ${downloadTime}ms (${(buffer.length / 1024 / 1024).toFixed(2)} Mo)`);

        fs.writeFileSync(XMLTV_ZIP_FILE, buffer);

        this.logger.log('📦 Extraction du ZIP...');
        const zip = new AdmZip(XMLTV_ZIP_FILE);
        zip.extractAllTo(CACHE_DIR, true);
        this.logger.log('✅ Extraction terminée');
    }

    private async parseXmltvFile(): Promise<void> {
        this.logger.log(`📄 Parsing du fichier XMLTV...`);
        const startTime = Date.now();

        const xmlContent = fs.readFileSync(XMLTV_FILE, 'utf-8');
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
        });

        const data = parser.parse(xmlContent);
        const parseTime = Date.now() - startTime;
        this.logger.log(`⏱️ Parsing en ${parseTime}ms`);

        // Extraire les chaînes
        const channelList = Array.isArray(data.tv.channel) ? data.tv.channel : [data.tv.channel];
        const channelsMap = new Map<string, string>();

        for (const channel of channelList) {
            const displayName = typeof channel['display-name'] === 'string'
                ? channel['display-name']
                : channel['display-name']['#text'] || channel['display-name'];
            channelsMap.set(channel['@_id'], displayName);
        }

        this.channels = Array.from(channelsMap.entries()).map(([id, name]) => ({id, name}));
        this.logger.log(`📺 ${this.channels.length} chaînes trouvées`);

        // Parser les programmes
        const programmeList: XmltvProgramme[] = Array.isArray(data.tv.programme)
            ? data.tv.programme
            : [data.tv.programme];

        this.logger.log(`📋 ${programmeList.length} programmes à analyser`);

        // Filtrer par chaîne
        const filteredProgrammes = this.channelFilter.length > 0
            ? programmeList.filter(p => this.channelFilter.includes(p['@_channel']))
            : programmeList;

        this.logger.log(`🔍 ${filteredProgrammes.length} programmes après filtrage des chaînes`);

        // Extraire les films
        this.movies = [];
        let shortFilmsCount = 0;
        for (const prog of filteredProgrammes) {
            if (this.isMovie(prog)) {
                this.movies.push(this.parseMovie(prog, channelsMap));
            } else if (this.isCategoryMovie(prog)) {
                // Compter les films trop courts (catégorie film mais durée < 1h)
                const startDate = this.parseXmltvDate(prog['@_start']);
                const endDate = this.parseXmltvDate(prog['@_stop']);
                const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
                if (durationMinutes < MIN_MOVIE_DURATION_MINUTES) {
                    shortFilmsCount++;
                }
            }
        }

        // Trier par date (ordre antéchronologique - les plus lointains d'abord)
        this.movies.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

        this.logger.log(`🎬 ${this.movies.length} films trouvés (${shortFilmsCount} exclus car < ${MIN_MOVIE_DURATION_MINUTES} min)`);
    }

    private isMovie(prog: XmltvProgramme): boolean {
        const categories = this.extractCategories(prog.category).map(c => c.toLowerCase());

        // Exclure certaines catégories
        const isExcluded = categories.some(cat =>
            EXCLUDED_CATEGORIES.some(excluded => cat.toLowerCase().includes(excluded.toLowerCase()))
        );
        if (isExcluded) {
            return false;
        }

        // Vérifier la durée minimale (1 heure)
        const startDate = this.parseXmltvDate(prog['@_start']);
        const endDate = this.parseXmltvDate(prog['@_stop']);
        const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
        if (durationMinutes < MIN_MOVIE_DURATION_MINUTES) return false;

        return true;
    }

    // Vérifie si le programme est catégorisé comme film (sans vérifier la durée)
    private isCategoryMovie(prog: XmltvProgramme): boolean {
        const categories = this.extractCategories(prog.category).map(c => c.toLowerCase());
        const isExcluded = categories.some(cat =>
            EXCLUDED_CATEGORIES.some(excluded => cat.toLowerCase().includes(excluded.toLowerCase()))
        );
        return !isExcluded;
    }

    private parseMovie(prog: XmltvProgramme, channelsMap: Map<string, string>): Movie {
        const channelId = prog['@_channel'];
        return {
            id: `${channelId}_${prog['@_start']}`,
            name: this.extractText(prog.title) || 'Sans titre',
            subtitle: this.extractText(prog['sub-title']),
            channel: channelsMap.get(channelId) || channelId,
            channelId,
            startDate: this.parseXmltvDate(prog['@_start']),
            endDate: this.parseXmltvDate(prog['@_stop']),
            categories: this.extractCategories(prog.category),
            description: this.extractText(prog.desc),
            rating: prog.rating?.value,
            icon: prog.icon?.['@_src'],
            year: prog.date,
            country: this.extractText(prog.country),
            directors: this.extractPeople(prog.credits?.director),
            actors: this.extractPeople(prog.credits?.actor || prog.credits?.guest),
        };
    }

    private extractText(element: string | { '#text': string } | undefined): string | undefined {
        if (!element) return undefined;
        if (typeof element === 'string') return element;
        return element['#text'];
    }

    private extractCategories(category: XmltvProgramme['category']): string[] {
        if (!category) return [];
        if (typeof category === 'string') return [category];
        if (Array.isArray(category)) {
            return category.map(c => typeof c === 'string' ? c : c['#text']);
        }
        return [typeof category === 'string' ? category : category['#text']];
    }

    private extractPeople(people: string | string[] | undefined): string[] {
        if (!people) return [];
        if (typeof people === 'string') return [people];
        return people;
    }

    private parseXmltvDate(dateStr: string): Date {
        const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/);
        if (!match) return new Date();

        const [, year, month, day, hour, minute, second, tz] = match;
        const isoDate = `${year}-${month}-${day}T${hour}:${minute}:${second}${tz ? tz.slice(0, 3) + ':' + tz.slice(3) : ''}`;
        return new Date(isoDate);
    }

    // API Methods
    async getMovies(channelFilter?: string[]): Promise<MoviesResponse> {
        const now = new Date();

        // Filtrer les films passés (ne garder que ceux qui n'ont pas encore commencé ou sont en cours)
        let filteredMovies = this.movies.filter(m => new Date(m.endDate) > now);

        if (channelFilter && channelFilter.length > 0) {
            filteredMovies = filteredMovies.filter(m => channelFilter.includes(m.channelId));
        }

        // Récupérer les enregistrements programmés sur la Freebox
        const scheduledRecordings = await this.getScheduledRecordings();

        // Enrichir les films avec l'info d'enregistrement
        const enrichedMovies = filteredMovies.map(movie => ({
            ...movie,
            isScheduled: this.isMovieScheduled(movie, scheduledRecordings),
        }));

        return {
            movies: enrichedMovies,
            totalCount: enrichedMovies.length,
            lastUpdated: this.lastUpdated,
            channels: this.channels,
        };
    }

    private async getScheduledRecordings(): Promise<any[]> {
        try {
            const result = await this.freeboxService.getRecordings();
            if (result.success && result.recordings) {
                return Array.isArray(result.recordings) ? result.recordings : Object.values(result.recordings);
            }
        } catch (error) {
            this.logger.warn('Impossible de récupérer les enregistrements Freebox:', error);
        }
        return [];
    }

    private isMovieScheduled(movie: Movie, recordings: any[]): boolean {
        if (!recordings || recordings.length === 0) return false;

        const movieStart = new Date(movie.startDate).getTime() / 1000;
        const movieEnd = new Date(movie.endDate).getTime() / 1000;
        const movieNameLower = `${movie.name}`.toLowerCase();

        return recordings.some(rec => {
            // Vérifier par nom (comparaison souple)
            const recName = (rec.name || '').toLowerCase();
            const nameMatch = recName.includes(movieNameLower) || movieNameLower.includes(recName);

            // rec.channel_name
            const channelMatch = rec.channel_name === movie.channel;

            // Vérifier par horaire (avec marge de 15 minutes)
            const margin = 15 * 60; // 15 minutes en secondes
            const timeMatch =
                Math.abs(rec.start - movieStart) < margin &&
                Math.abs(rec.end - movieEnd) < margin;

            // Match si le nom correspond OU si l'horaire correspond
            return (nameMatch || timeMatch) && channelMatch;
        });
    }

    getMovieById(id: string): Movie | undefined {
        return this.movies.find(m => m.id === id);
    }

    setChannelFilter(channels: string[]): void {
        this.channelFilter = channels;
        this.logger.log(`🔍 Filtre de chaînes mis à jour: ${channels.join(', ')}`);
    }

    getChannelFilter(): string[] {
        return this.channelFilter;
    }

    getAllChannels(): Channel[] {
        return this.channels;
    }
}

