/**
 * Service de filtrage des films
 */

import { MOVIE_CATEGORIES, CHANNEL_FILTER, EXCLUDED_CATEGORIES } from "../config";
import { ParsedProgram, Movie } from "../models";

/**
 * Vérifie si un programme est un film (et pas un téléfilm)
 */
export function isMovie(program: ParsedProgram): boolean {
    const categories = program.categories.map((c) => c.toLowerCase());

    // Vérifier si c'est une catégorie exclue (téléfilm)
    const isExcluded = categories.some((cat) =>
        EXCLUDED_CATEGORIES.some((excludedCat) => cat.includes(excludedCat))
    );

    if (isExcluded) {
        return false;
    }

    // Vérifier si c'est un film
    return categories.some((cat) =>
        MOVIE_CATEGORIES.some((movieCat) => cat.includes(movieCat))
    );
}

/**
 * Vérifie si une catégorie est exclue
 */
function isExcludedCategory(cat: string): boolean {
    return EXCLUDED_CATEGORIES.some((excludedCat) =>
        cat.toLowerCase().includes(excludedCat)
    );
}

/**
 * Filtre les programmes pour ne garder que les films
 */
export function filterMovies(
    programs: ParsedProgram[],
    channels: Map<string, string>
): {
    movies: Movie[];
    stats: {
        categoryStats: Map<string, number>;
        channelStats: Map<string, { total: number; movies: number }>;
        filteredPrograms: ParsedProgram[];
    };
} {
    const movies: Movie[] = [];
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

    return {
        movies,
        stats: {
            categoryStats,
            channelStats,
            filteredPrograms,
        },
    };
}

/**
 * Affiche les statistiques de filtrage
 */
export function printFilterStats(
    channels: Map<string, string>,
    filteredPrograms: ParsedProgram[],
    totalPrograms: number,
    movies: Movie[],
    categoryStats: Map<string, number>,
    channelStats: Map<string, { total: number; movies: number }>
): void {
    console.log("=".repeat(80));
    console.log("📈 STATISTIQUES DE FILTRAGE");
    console.log("=".repeat(80));

    if (CHANNEL_FILTER.length > 0) {
        console.log(`\n🔍 Chaînes filtrées: ${CHANNEL_FILTER.length} (${CHANNEL_FILTER.join(", ")})`);
    }

    console.log(`📺 Chaînes analysées: ${channelStats.size}${CHANNEL_FILTER.length === 0 ? ` (toutes les ${channels.size} chaînes)` : ""}`);
    console.log(`📋 Programmes analysés: ${filteredPrograms.length}${CHANNEL_FILTER.length > 0 ? ` (sur ${totalPrograms} total)` : ""}`);
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
        const isExcluded = isExcludedCategory(cat);
        let marker = "  ";
        if (isExcluded) {
            marker = "🚫";
        } else if (isMovieCat) {
            marker = "🎬";
        }
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
}

/**
 * Groupe les films par jour
 */
export function groupMoviesByDay(movies: Movie[]): Map<string, Movie[]> {
    const moviesByDay = new Map<string, Movie[]>();

    for (const movie of movies) {
        const dayKey = movie.startDate.toLocaleDateString("fr-FR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
        if (!moviesByDay.has(dayKey)) {
            moviesByDay.set(dayKey, []);
        }
        moviesByDay.get(dayKey)!.push(movie);
    }

    return moviesByDay;
}

