# ---- Etapa 1: Build ----
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Con SSR habilitado, este comando genera tanto el bundle
# de browser como el de server dentro de dist/frontend
RUN npm run build

# ---- Etapa 2: Runtime ----
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/dist/frontend ./dist/frontend
COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json ./

EXPOSE 4000


CMD ["node", "dist/frontend/server/server.mjs"]