# Stage 1: Build TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Stage 2: Production — lightweight, no Playwright browser
# Playwright is used as a local fallback only.
# On Render, the Voyager Dash API (Tier 2) works reliably on cloud IPs.
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

# Copy compiled JavaScript
COPY --from=builder /app/dist ./dist

# Copy the static frontend
COPY public ./public

EXPOSE 3000

CMD ["node", "dist/index.js"]
