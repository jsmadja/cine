import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'cache');
const IMDB_CACHE_FILE = path.join(CACHE_DIR, 'imdb_cache.json');

// TMDB API (gratuite, supporte les titres français)
// Clé API gratuite - créer un compte sur https://www.themoviedb.org/ pour obtenir la vôtre
const TMDB_API_KEY = process.env.TMDB_API_KEY || '47988b5c1ee1f791923eee7a6053b881';

interface ImdbRating {
  imdbRating: string | null;
  imdbID: string | null;
  tmdbID?: number | null;
  fetchedAt: number;
}

interface ImdbCache {
  [movieKey: string]: ImdbRating;
}

interface TmdbSearchResult {
  id: number;
  title: string;
  original_title: string;
  release_date?: string;
  vote_average?: number;
}

interface TmdbMovieDetails {
  id: number;
  imdb_id?: string;
  vote_average?: number;
}

@Injectable()
export class ImdbService {
  private readonly logger = new Logger(ImdbService.name);
  private cache: ImdbCache = {};
  private readonly CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

  constructor() {
    this.loadCache();
  }

  private loadCache(): void {
    try {
      if (fs.existsSync(IMDB_CACHE_FILE)) {
        this.cache = JSON.parse(fs.readFileSync(IMDB_CACHE_FILE, 'utf-8'));
        this.logger.log(`📂 Cache IMDB chargé: ${Object.keys(this.cache).length} films`);
      }
    } catch (error) {
      this.logger.warn('Erreur lecture cache IMDB:', error);
      this.cache = {};
    }
  }

  private saveCache(): void {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      fs.writeFileSync(IMDB_CACHE_FILE, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error('Erreur sauvegarde cache IMDB:', error);
    }
  }

  private generateKey(title: string, year?: string): string {
    // Normaliser le titre pour la clé de cache
    const normalizedTitle = `${title}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
      .replace(/[^a-z0-9]/g, '_');
    return year ? `${normalizedTitle}_${year}` : normalizedTitle;
  }

  private isCacheValid(rating: ImdbRating): boolean {
    return Date.now() - rating.fetchedAt < this.CACHE_DURATION_MS;
  }

  async getRating(title: string, year?: string): Promise<{ imdbRating: string | null; imdbID: string | null }> {
    const key = this.generateKey(title, year);

    // Vérifier le cache
    if (this.cache[key] && this.isCacheValid(this.cache[key])) {
      return {
        imdbRating: this.cache[key].imdbRating,
        imdbID: this.cache[key].imdbID,
      };
    }

    // Appeler l'API TMDB
    try {
      const result = await this.fetchFromTmdb(title, year);
      this.cache[key] = {
        ...result,
        fetchedAt: Date.now(),
      };
      this.saveCache();
      return { imdbRating: result.imdbRating, imdbID: result.imdbID };
    } catch (error) {
      this.logger.warn(`Erreur TMDB pour "${title}":`, error);
      // Mettre en cache le résultat négatif pour éviter de réessayer
      this.cache[key] = {
        imdbRating: null,
        imdbID: null,
        fetchedAt: Date.now(),
      };
      this.saveCache();
      return { imdbRating: null, imdbID: null };
    }
  }

  /**
   * Recherche un film sur TMDB (supporte les titres français)
   * puis récupère l'ID IMDB et la note
   */
  private async fetchFromTmdb(title: string, year?: string): Promise<{ imdbRating: string | null; imdbID: string | null; tmdbID: number | null }> {
    // Étape 1: Rechercher le film par titre (en français)
    const searchParams = new URLSearchParams({
      api_key: TMDB_API_KEY,
      query: title,
      language: 'fr-FR',
      include_adult: 'false',
    });

    if (year) {
      searchParams.append('year', year);
    }

    const searchUrl = `https://api.themoviedb.org/3/search/movie?${searchParams.toString()}`;
    const searchResponse = await fetch(searchUrl);

    if (!searchResponse.ok) {
      throw new Error(`TMDB search HTTP error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const results: TmdbSearchResult[] = searchData.results || [];

    if (results.length === 0) {
      return { imdbRating: null, imdbID: null, tmdbID: null };
    }

    // Prendre le premier résultat (le plus pertinent)
    const movie = results[0];

    // Étape 2: Récupérer les détails du film pour obtenir l'ID IMDB
    const detailsUrl = `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}`;
    const detailsResponse = await fetch(detailsUrl);

    if (!detailsResponse.ok) {
      // Si on ne peut pas récupérer les détails, retourner au moins la note TMDB
      const rating = movie.vote_average ? movie.vote_average.toFixed(1) : null;
      return { imdbRating: rating, imdbID: null, tmdbID: movie.id };
    }

    const details: TmdbMovieDetails = await detailsResponse.json();

    // La note TMDB (sur 10, comme IMDB)
    const rating = details.vote_average ? details.vote_average.toFixed(1) : null;

    return {
      imdbRating: rating,
      imdbID: details.imdb_id || null,
      tmdbID: movie.id,
    };
  }

  /**
   * Récupère les notes pour plusieurs films en batch
   * Optimisé pour ne faire qu'un seul appel par film unique (basé sur titre + année)
   */
  async getRatingsForMovies(
    movies: Array<{ name: string; year?: string }>
  ): Promise<Map<string, { imdbRating: string | null; imdbID: string | null }>> {
    const results = new Map<string, { imdbRating: string | null; imdbID: string | null }>();
    const uniqueMovies = new Map<string, { name: string; year?: string }>();

    // Identifier les films uniques
    for (const movie of movies) {
      const key = this.generateKey(movie.name, movie.year);
      if (!uniqueMovies.has(key)) {
        uniqueMovies.set(key, movie);
      }
    }

    this.logger.log(`🎬 Récupération notes TMDB: ${movies.length} films, ${uniqueMovies.size} uniques`);

    let fetchedCount = 0;
    let cachedCount = 0;

    // Récupérer les notes pour chaque film unique
    for (const [key, movie] of uniqueMovies) {
      // Vérifier le cache d'abord
      if (this.cache[key] && this.isCacheValid(this.cache[key])) {
        results.set(key, {
          imdbRating: this.cache[key].imdbRating,
          imdbID: this.cache[key].imdbID,
        });
        cachedCount++;
        continue;
      }

      // Appeler l'API TMDB avec un délai pour ne pas surcharger
      try {
        const result = await this.fetchFromTmdb(movie.name, movie.year);
        this.cache[key] = {
          ...result,
          fetchedAt: Date.now(),
        };
        results.set(key, { imdbRating: result.imdbRating, imdbID: result.imdbID });
        fetchedCount++;

        // Petit délai entre les appels pour respecter les limites de l'API TMDB (40 req/10s)
        if (fetchedCount % 35 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        this.cache[key] = {
          imdbRating: null,
          imdbID: null,
          fetchedAt: Date.now(),
        };
        results.set(key, { imdbRating: null, imdbID: null });
      }
    }

    // Sauvegarder le cache après le batch
    this.saveCache();

    this.logger.log(`✅ Notes TMDB: ${cachedCount} en cache, ${fetchedCount} récupérées`);

    return results;
  }

  /**
   * Génère une clé pour un film donné (utile pour le mapping côté appelant)
   */
  getMovieKey(title: string, year?: string): string {
    return this.generateKey(title, year);
  }
}

