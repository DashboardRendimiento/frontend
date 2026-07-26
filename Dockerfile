# ---- Etapa 1: Build ----
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

# ---- Etapa 2: Runtime ----
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=build /app/dist/frontend ./dist/frontend
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD wget -qO- http://localhost:4000/ || exit 1

CMD ["node", "dist/frontend/server/server.mjs"]