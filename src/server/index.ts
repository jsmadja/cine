/**
 * Serveur Express pour l'API Freebox
 */

import express from "express";
import cors from "cors";
import { SERVER_CONFIG } from "../config";
import freeboxRoutes from "./routes";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/freebox", freeboxRoutes);

// Démarrer le serveur
export function startServer(): void {
    app.listen(SERVER_CONFIG.port, () => {
        console.log(`
🎬 ====================================
   Serveur Freebox TV Recorder
   ====================================
   
   🌐 URL: http://localhost:${SERVER_CONFIG.port}
   
   📡 Endpoints:
   - POST /api/freebox/authorize       → Demander l'autorisation
   - GET  /api/freebox/authorize/status → Vérifier le statut
   - GET  /api/freebox/status          → Statut de connexion
   - GET  /api/freebox/channels        → Liste des chaînes
   - POST /api/freebox/record          → Programmer un enregistrement
   - GET  /api/freebox/recordings      → Liste des enregistrements
   
   ====================================
`);
    });
}

// Point d'entrée si exécuté directement
startServer();

