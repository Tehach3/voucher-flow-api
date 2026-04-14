# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias primero para aprovechar cache de capas
COPY package*.json ./
RUN npm ci

# Compilar TypeScript
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ─── Stage 2: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# dumb-init: actúa como PID 1 y reenvía señales (SIGTERM/SIGINT) al proceso Node.
# Necesario para que docker stop y Railway deployment drains hagan graceful shutdown.
RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production

# Usuario no-root — Railway lo soporta y es buena práctica de seguridad
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Instalar SOLO dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Artefactos compilados desde el stage builder
COPY --from=builder /app/dist ./dist

# Permisos al usuario no-root antes de hacer el switch
RUN chown -R appuser:appgroup /app
USER appuser

# Railway inyecta la variable PORT automáticamente; EXPOSE es informativo
EXPOSE 3000

# Health check local — Railway tiene el suyo propio, pero sirve para docker run local
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# dumb-init como punto de entrada para manejo correcto de señales
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
