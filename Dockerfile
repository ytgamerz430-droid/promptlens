# ---- Build stage: install deps and build the React frontend ----
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY apps/api apps/api
COPY apps/web apps/web
RUN npm run build --workspace apps/web

# ---- Runtime stage: production deps + built frontend + API ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    DATABASE_PATH=/data/app.db \
    UPLOAD_DIR=/data/uploads

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev && npm cache clean --force

COPY apps/api/src apps/api/src
COPY --from=build /app/apps/web/dist apps/web/dist

# Non-root user; /data holds SQLite + uploads and must persist.
RUN addgroup -S app && adduser -S app -G app \
  && mkdir -p /data && chown -R app:app /app /data
USER app
VOLUME /data
EXPOSE 4000

# Required at runtime: SESSION_SECRET (JWT signing + BYOK encryption key).
# Optional: GEMINI_API_KEY / GROQ_API_KEY / MISTRAL_API_KEY / OPENAI_API_KEY,
# DEFAULT_PROVIDER, SMTP_*, GOOGLE_CLIENT_ID/SECRET, ADOBE_STOCK_API_KEY.
CMD ["node", "apps/api/src/index.js"]
