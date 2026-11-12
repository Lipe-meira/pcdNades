FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg postgresql-client ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --ignore-scripts
RUN ln -s /usr/bin/ffmpeg node_modules/ffmpeg-static/ffmpeg
COPY backend/ ./
RUN node scripts/prepare-probe.mjs
COPY docs/validation/pr19/ /lab/
ENV FFPROBE_PATH=/usr/bin/ffprobe FFMPEG_PATH=/usr/bin/ffmpeg
