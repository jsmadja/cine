/**
 * Script principal - Liste les films TV et génère une page HTML
 */

import { parseXmltvFile } from "./services/xmltv.service";
import { filterMovies, printFilterStats, groupMoviesByDay } from "./services/movie.service";
import { generateHtmlPage } from "./services/html-generator.service";

async function main(): Promise<void> {
    console.log("🎬 Analyse des programmes TV...\n");

    try {
        // Parser le fichier XMLTV
        const { channels, programs } = await parseXmltvFile();

        // Filtrer les films
        const { movies, stats } = filterMovies(programs, channels);

        // Afficher les statistiques
        printFilterStats(
            channels,
            stats.filteredPrograms,
            programs.length,
            movies,
            stats.categoryStats,
            stats.channelStats
        );

        // Trier les films par date
        movies.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

        if (movies.length === 0) {
            console.log("Aucun film trouvé dans les programmes à venir.");
            return;
        }

        // Grouper les films par jour
        const moviesByDay = groupMoviesByDay(movies);

        // Générer la page HTML
        generateHtmlPage(movies, moviesByDay);
    } catch (error) {
        console.error("❌ Erreur:", error);
        process.exit(1);
    }
}

main();

