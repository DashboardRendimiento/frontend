# --- ETAPA 1: Compilar la app de Angular ---
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias e instalarlas
COPY package*.json ./
RUN npm install

# Copiar el código fuente y compilar Angular
COPY . .
RUN npm run build -- --configuration=production

# --- ETAPA 2: Servir los archivos estáticos con Nginx ---
FROM nginx:alpine

# IMPORTANTE: Revisa la ruta de 'dist' en tu proyecto.
# En Angular 17/18 suele ser: /app/dist/<nombre-de-tu-proyecto>/browser
# En versiones anteriores era: /app/dist/<nombre-de-tu-proyecto>
COPY --from=builder /app/dist/*/browser /usr/share/nginx/html

# Copiar configuración para soportar rutas de Angular (SPA)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
