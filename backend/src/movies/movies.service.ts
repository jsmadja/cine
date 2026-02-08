import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import AdmZip from 'adm-zip';
import { Movie, Channel, MoviesResponse } from './movie.interface';

// Configuration
const XMLTV_URL = 'https://xmltvfr.fr/xmltv/xmltv_fr.zip';
const CACHE_DIR = path.join(process.cwd(), 'cache');
const XMLTV_FILE = path.join(CACHE_DIR, 'xmltv_fr.xml');
const XMLTV_ZIP_FILE = path.join(CACHE_DIR, 'xmltv_fr.zip');
const MOVIES_CACHE_FILE = path.join(CACHE_DIR, 'movies_cache.json');
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 heures

// Catégories de films
const MOVIE_CATEGORIES = ['film', 'cinéma', 'cinema', 'long métrage', 'long metrage'];
const EXCLUDED_CATEGORIES = ['téléfilm', 'telefilm'];

// Chaînes par défaut (modifiable)
const DEFAULT_CHANNEL_FILTER = [
  'RTL9.fr', 'TMC.fr', 'Arte.fr', 'France2.fr', 'France3.fr',
  'France4.fr', 'France5.fr', 'W9.fr', 'TF1.fr', 'M6.fr',
  'Canal+.fr', 'CanalPlusCinema.fr', 'Cine+Premier.fr', 'Cine+Frisson.fr',
];

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

  constructor() {
    this.ensureCacheDir();
    this.loadFromCache();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
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

    this.channels = Array.from(channelsMap.entries()).map(([id, name]) => ({ id, name }));
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
    for (const prog of filteredProgrammes) {
      if (this.isMovie(prog)) {
        this.movies.push(this.parseMovie(prog, channelsMap));
      }
    }

    // Trier par date
    this.movies.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    this.logger.log(`🎬 ${this.movies.length} films trouvés`);
  }

  private isMovie(prog: XmltvProgramme): boolean {
    const categories = this.extractCategories(prog.category).map(c => c.toLowerCase());

    // Exclure les téléfilms
    const isExcluded = categories.some(cat =>
      EXCLUDED_CATEGORIES.some(excluded => cat.includes(excluded))
    );
    if (isExcluded) return false;

    // Vérifier si c'est un film
    return categories.some(cat =>
      MOVIE_CATEGORIES.some(movieCat => cat.includes(movieCat))
    );
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
  getMovies(channelFilter?: string[]): MoviesResponse {
    let filteredMovies = this.movies;

    if (channelFilter && channelFilter.length > 0) {
      filteredMovies = this.movies.filter(m => channelFilter.includes(m.channelId));
    }

    return {
      movies: filteredMovies,
      totalCount: filteredMovies.length,
      lastUpdated: this.lastUpdated,
      channels: this.channels,
    };
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

