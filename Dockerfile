# * build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

# * production stage
FROM node:22-bookworm-slim

WORKDIR /app

# * install LibreOffice + fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-writer \
    libreoffice-core \
    libreoffice-common \
    fonts-dejavu-core \
    fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY yarn.lock ./

RUN yarn install --frozen-lockfile --production

COPY --from=builder /app/dist ./dist

COPY src/templates ./src/templates

COPY .env ./.env

# * create necessary directories with proper permissions
RUN mkdir -p logs src/temp src/uploads/csv src/uploads/documents src/uploads/images src/uploads/spreadsheets && \
    chown -R node:node /app

# * switch to non-root user
USER node

# * set config directory to compiled location
ENV NODE_CONFIG_DIR=/app/dist/config

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/src/index.js"]
