# syntax=docker/dockerfile:1
# Contexte de build : la racine du dépôt (docker compose s'en charge).

# ---- Étape 1 : build Angular ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npx nx build web --configuration=production

# ---- Étape 2 : nginx sert les fichiers statiques et proxifie /api vers l'API ----
FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/apps/web/browser /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
