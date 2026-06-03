# -------- Build Stage --------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build


# -------- Runtime Stage --------
FROM node:22-bookworm-slim

WORKDIR /app

# Install LibreOffice + fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-writer \
    libreoffice-core \
    libreoffice-common \
    fonts-dejavu-core \
    fonts-noto-core \
    wget \
    && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile --production=true

COPY --from=builder /app/dist ./dist
COPY src/templates ./src/templates

# create directories
RUN mkdir -p logs src/temp src/uploads/csv src/uploads/documents src/uploads/images src/uploads/spreadsheets && \
    chown -R node:node /app

USER node

ENV NODE_CONFIG_DIR=/app/dist/config

EXPOSE 8080

CMD ["node", "dist/src/index.js"]