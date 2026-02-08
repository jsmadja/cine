# 🎬 Ciné - Programme TV des Films

Application pour lister les films diffusés sur les chaînes TV françaises et programmer des enregistrements sur Freebox.

## Fonctionnalités

- 📺 Récupération automatique des programmes TV (source XMLTV)
- 🎬 Filtrage intelligent des films (exclusion des téléfilms)
- 🔍 Filtrage par chaînes configurables
- 📄 Génération d'une page HTML responsive (style Netflix)
- ⏺️ Programmation d'enregistrements sur Freebox
- 💾 Cache intelligent (24h) pour éviter les téléchargements répétés

## Prérequis

- Node.js 20+ ou Docker
- Freebox (optionnel, pour les enregistrements)

## Installation

### Avec Node.js

```bash
# Cloner le projet
git clone <repo>
cd cine

# Installer les dépendances
npm install

# Compiler
npm run build
```

### Avec Docker

```bash
docker compose build
```

## Utilisation

### Générer la liste des films

```bash
# Avec Node.js
npm start

# Avec Docker
docker compose run --rm films
```

La page HTML est générée dans `cache/films.html`.

### Lancer les serveurs (web + API Freebox)

```bash
# Avec Docker (recommandé)
docker compose up -d web server

# Avec Node.js
npm run server
```

### Accéder à l'interface

| Service | URL |
|---------|-----|
| 📺 Page des films | http://localhost:8080/films.html |
| 📡 API Freebox | http://localhost:3000/api/freebox/status |

### Ouvrir la page directement

```bash
# macOS
open http://localhost:8080/films.html

# Linux
xdg-open http://localhost:8080/films.html

# Windows
start http://localhost:8080/films.html
```

## Commandes disponibles

### NPM

| Commande | Description |
|----------|-------------|
| `npm start` | Générer la liste des films |
| `npm run build` | Compiler TypeScript |
| `npm run dev` | Mode développement |
| `npm run server` | Lancer le serveur API Freebox |
| `npm run channels` | Lister toutes les chaînes disponibles |

### Docker

| Commande | Description |
|----------|-------------|
| `docker compose build` | Construire les images |
| `docker compose run --rm films` | Générer la liste des films |
| `docker compose up -d web server` | Lancer web + API |
| `docker compose logs -f` | Voir les logs |
| `docker compose down` | Arrêter les services |

## Configuration

Modifier le fichier `src/config/index.ts` :

### Filtrer les chaînes

```typescript
export const CHANNEL_FILTER: string[] = [
    "TF1.fr",
    "France2.fr",
    "Arte.fr",
    "RTL9.fr",
    // Ajouter les chaînes souhaitées
];
```

> 💡 Utilisez `npm run channels` pour voir la liste complète des chaînes disponibles.

### Catégories de films

```typescript
export const MOVIE_CATEGORIES = [
    "film",
    "cinéma",
    "cinema",
    "long métrage",
];

// Catégories exclues
export const EXCLUDED_CATEGORIES = [
    "téléfilm",
    "telefilm",
];
```

## Structure du projet

```
cine/
├── src/
│   ├── config/          # Configuration
│   ├── models/          # Interfaces TypeScript
│   ├── services/        # Logique métier
│   │   ├── cache.service.ts
│   │   ├── xmltv.service.ts
│   │   ├── movie.service.ts
│   │   ├── freebox.service.ts
│   │   └── html-generator.service.ts
│   ├── server/          # API Express
│   ├── utils/           # Utilitaires
│   └── index.ts         # Point d'entrée
├── cache/               # Fichiers en cache
│   ├── xmltv_fr.xml     # Programme TV
│   ├── films.html       # Page générée
│   └── channels.txt     # Liste des chaînes
├── dist/                # Code compilé
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Enregistrement Freebox

### Première connexion

1. Lancez le serveur : `docker compose up -d server`
2. Ouvrez la page des films
3. Cliquez sur "Freebox" dans l'en-tête
4. Cliquez sur "Autoriser"
5. **Validez sur l'écran LCD de votre Freebox** (appuyez sur ➡️)
6. Cliquez sur "Vérifier"

### Programmer un enregistrement

Cliquez sur le bouton "⏺️ Enregistrer sur Freebox" sur n'importe quel film.

L'enregistrement inclut automatiquement :
- 5 minutes avant le début
- 10 minutes après la fin

## API Freebox

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/freebox/status` | GET | Statut de connexion |
| `/api/freebox/authorize` | POST | Demander l'autorisation |
| `/api/freebox/authorize/status` | GET | Vérifier l'autorisation |
| `/api/freebox/channels` | GET | Liste des chaînes Freebox |
| `/api/freebox/record` | POST | Programmer un enregistrement |
| `/api/freebox/recordings` | GET | Liste des enregistrements |

## Licence

ISC

---

## Publier l'image Docker (pour NAS/Portainer)

### 1. Se connecter à Docker Hub

```bash
docker login
```

### 2. Construire et taguer l'image

```bash
# Remplacer VOTRE_USERNAME par votre nom d'utilisateur Docker Hub
docker build -t VOTRE_USERNAME/cine:latest .

# Pour une image multi-architecture (ARM64 pour NAS UGreen)
docker buildx create --use
docker buildx build --platform linux/amd64,linux/arm64 -t VOTRE_USERNAME/cine:latest --push .
```

### 3. Pousser l'image

```bash
docker push VOTRE_USERNAME/cine:latest
```

### 4. Utiliser sur Portainer (NAS UGreen)

Dans Portainer, créez une nouvelle stack avec ce `docker-compose.yml` :

```yaml
services:
  films:
    image: jsmadja/cine:latest
    container_name: cine-films
    volumes:
      - ./cache:/app/cache
    command: node dist/index.js

  web:
    image: nginx:alpine
    container_name: cine-web
    ports:
      - "8080:80"
    volumes:
      - ./cache:/usr/share/nginx/html:ro
    restart: unless-stopped

  server:
    image: jsmadja/cine:latest
    container_name: cine-server
    ports:
      - "3000:3000"
    volumes:
      - ./cache:/app/cache
    command: node dist/server/index.js
    restart: unless-stopped
```

### 5. Accéder depuis le NAS

- Page des films : `http://IP_DU_NAS:8080/films.html`
- API Freebox : `http://IP_DU_NAS:3000/api/freebox/status`

