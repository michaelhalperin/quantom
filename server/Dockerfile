# Always-on paper-trading backend. Node 22 for built-in node:sqlite + fetch.
FROM node:22-slim

WORKDIR /app

# Install deps first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# App source (config.json ships with autoStart=true for a hosted deploy).
COPY . .

# The SQLite database lives here — mount a persistent disk at /app/data so
# paper history survives restarts and redeploys.
RUN mkdir -p /app/data

ENV PORT=8787
ENV AUTO_START=true
# Lock CORS to your deployed dashboard origin in production if you prefer.
ENV CORS_ORIGIN=*

EXPOSE 8787

# npm start = node --import tsx --experimental-sqlite src/index.ts
CMD ["npm", "start"]
