# Playwright's official image already bundles Chromium + all OS deps.
# Pin the tag to whatever playwright version is in package.json.
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

# Install deps first for better layer caching
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# App source
COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production \
    PORT=3030 \
    TZ_NAME=Asia/Kolkata \
    PROFILE_DIR=/data/profile \
    RUN_LOG_DIR=/data/runs \
    TZ=Asia/Kolkata

# /data is the volume mount point: persists the Chromium profile and run log
VOLUME ["/data"]

EXPOSE 3030

CMD ["node", "src/server.js"]
