# Dockerfile pour l'application Films TV
# Build multi-stage pour compiler TypeScript

# Étape 1 : Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer toutes les dépendances (y compris dev)
RUN npm ci

# Copier le code source
COPY tsconfig.json ./
COPY src/ ./src/

# Compiler TypeScript
RUN npm run build

# Étape 2 : Production
FROM node:20-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer uniquement les dépendances de production
RUN npm ci --only=production

# Copier le code compilé depuis l'étape de build
COPY --from=builder /app/dist ./dist/

# Créer le dossier de cache
RUN mkdir -p /app/cache

# Exposer le port du serveur Freebox
EXPOSE 3000

# Commande par défaut : lister les films
CMD ["node", "dist/index.js"]


