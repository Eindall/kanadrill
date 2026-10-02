# syntax=docker/dockerfile:1
# Contexte de build : la racine du dépôt (docker compose s'en charge).

# ---- Étape 1 : build du bundle NestJS ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npx nx build api --configuration=production

# ---- Étape 2 : image d'exécution, uniquement les dépendances de prod ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Nx génère un package.json réduit aux dépendances réellement utilisées par l'API (versions épinglées).
# On n'utilise pas son package-lock.json : il n'est pas toujours synchronisé avec ce package.json, ce qui fait échouer `npm ci`.
COPY --from=build /app/dist/apps/api/package.json ./
RUN npm install --omit=dev --no-package-lock --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist/apps/api/main.js ./main.js
# Données des kanji (lues par le seed au démarrage), copiées à côté du bundle par webpack.
COPY --from=build /app/dist/apps/api/assets ./assets

USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "main.js"]
