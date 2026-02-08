# 🎬 Ciné - Programme TV des Films

Application pour lister les films diffusés sur les chaînes TV françaises et programmer des enregistrements sur Freebox.

## Architecture

- **Frontend** : Vue.js 3 + TypeScript + Pinia
- **Backend** : NestJS + TypeScript
- **Données** : XMLTV (rafraîchies automatiquement chaque jour à 6h)

## Fonctionnalités

- 📺 Récupération automatique des programmes TV (source XMLTV)
- 🎬 Filtrage intelligent des films (exclusion des téléfilms)
- 🔍 Filtrage par chaînes configurables
- 📄 Interface web responsive (style Netflix)
- ⏺️ Programmation d'enregistrements sur Freebox
- 💾 Cache intelligent (24h) pour éviter les téléchargements répétés
- 🔄 Rafraîchissement automatique quotidien

## Prérequis

- Docker & Docker Compose
- Freebox (optionnel, pour les enregistrements)

## Démarrage rapide

### Avec Docker (recommandé)

```bash
# Construire et lancer
docker compose up -d

# Voir les logs
docker compose logs -f
```

### Accéder à l'application

| Service | URL |
|---------|-----|
| 📺 Frontend (Vue.js) | http://localhost:8080 |
| 📡 Backend (API) | http://localhost:3000/api |

## Développement

### Mode développement

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (dans un autre terminal)
cd frontend
npm install
npm run dev
```

Le frontend sera accessible sur http://localhost:5173

### Structure du projet

```
cine/
├── backend/                 # API NestJS
│   ├── src/
│   │   ├── movies/         # Module films
│   │   ├── freebox/        # Module Freebox
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── Dockerfile
│   └── package.json
├── frontend/                # App Vue.js
│   ├── src/
│   │   ├── api/            # Appels API
│   │   ├── components/     # Composants Vue
│   │   ├── stores/         # Pinia stores
│   │   ├── types/          # Types TypeScript
│   │   └── views/          # Pages
│   ├── Dockerfile
│   └── package.json
├── cache/                   # Données en cache
├── docker-compose.yml
└── README.md
```

## API Backend

### Films

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/movies` | GET | Liste des films |
| `/api/movies?channels=TF1.fr,M6.fr` | GET | Films filtrés par chaîne |
| `/api/movies/refresh` | GET | Rafraîchir les données |
| `/api/movies/channels` | GET | Liste des chaînes |
| `/api/movies/filter` | GET | Filtre actuel |
| `/api/movies/filter` | POST | Définir le filtre |
| `/api/movies/:id` | GET | Détails d'un film |

### Freebox

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/freebox/status` | GET | Statut de connexion |
| `/api/freebox/authorize` | POST | Demander l'autorisation |
| `/api/freebox/authorize/status` | GET | Vérifier l'autorisation |
| `/api/freebox/channels` | GET | Chaînes Freebox |
| `/api/freebox/record` | POST | Programmer un enregistrement |
| `/api/freebox/recordings` | GET | Liste des enregistrements |

## Enregistrement Freebox

### Première connexion

1. Ouvrez l'application http://localhost:8080
2. Cliquez sur "Freebox" dans l'en-tête
3. Cliquez sur "Autoriser"
4. **Validez sur l'écran LCD de votre Freebox** (appuyez sur ➡️)
5. Cliquez sur "Vérifier"

### Programmer un enregistrement

Cliquez sur "⏺️ Enregistrer sur Freebox" sur n'importe quel film.

## Déploiement sur NAS (Portainer)

### 1. Publier les images Docker

```bash
# Se connecter
docker login

# Construire et pousser
docker buildx build --platform linux/amd64,linux/arm64 -t VOTRE_USERNAME/cine-backend:latest --push ./backend
docker buildx build --platform linux/amd64,linux/arm64 -t VOTRE_USERNAME/cine-frontend:latest --push ./frontend
```

### 2. Stack Portainer

```yaml
services:
  backend:
    image: VOTRE_USERNAME/cine-backend:latest
    container_name: cine-backend
    ports:
      - "3000:3000"
    volumes:
      - ./cache:/app/cache
    restart: unless-stopped

  frontend:
    image: VOTRE_USERNAME/cine-frontend:latest
    container_name: cine-frontend
    ports:
      - "8080:80"
    depends_on:
      - backend
    restart: unless-stopped
```

### 3. Accès

- **Frontend** : `http://IP_DU_NAS:8080`
- **Backend** : `http://IP_DU_NAS:3000/api`

## Licence

ISC
