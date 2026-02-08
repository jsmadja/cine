/**
 * Script pour lister toutes les chaînes disponibles
 */

import * as fs from "fs";
import * as path from "path";
import { parseXmltvFile } from "./services/xmltv.service";
import { CACHE_DIR } from "./config";

async function listChannels(): Promise<void> {
    console.log("📺 Récupération de la liste des chaînes...\n");

    try {
        const { channels } = await parseXmltvFile();

        // Trier les chaînes par nom
        const sortedChannels = [...channels.entries()].sort((a, b) =>
            a[1].localeCompare(b[1], "fr")
        );

        // Créer le contenu du fichier
        let content = "=".repeat(60) + "\n";
        content += "LISTE DES CHAÎNES TV DISPONIBLES\n";
        content += `Généré le: ${new Date().toLocaleString("fr-FR")}\n`;
        content += `Total: ${channels.size} chaîne(s)\n`;
        content += "=".repeat(60) + "\n\n";

        content += "ID de la chaîne                    | Nom affiché\n";
        content += "-".repeat(60) + "\n";

        for (const [id, name] of sortedChannels) {
            content += `${id.padEnd(35)} | ${name}\n`;
        }

        content += "\n" + "=".repeat(60) + "\n";
        content += "Pour filtrer les chaînes, ajoutez les IDs dans CHANNEL_FILTER\n";
        content += "dans le fichier src/config/index.ts\n";
        content += "\nExemple:\n";
        content += 'const CHANNEL_FILTER: string[] = [\n';
        content += '    "TF1.fr",\n';
        content += '    "France2.fr",\n';
        content += '    "M6.fr",\n';
        content += '];\n';

        // Écrire le fichier
        const outputFile = path.join(CACHE_DIR, "channels.txt");

        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
        }

        fs.writeFileSync(outputFile, content, "utf-8");

        console.log(`✅ Liste des ${channels.size} chaîne(s) écrite dans: ${outputFile}`);
        console.log("\nAperçu des 20 premières chaînes:");
        console.log("-".repeat(60));

        sortedChannels.slice(0, 20).forEach(([id, name]) => {
            console.log(`  ${id.padEnd(30)} → ${name}`);
        });

        if (sortedChannels.length > 20) {
            console.log(`  ... et ${sortedChannels.length - 20} autres chaînes`);
        }

    } catch (error) {
        console.error("❌ Erreur:", error);
        process.exit(1);
    }
}

listChannels();

