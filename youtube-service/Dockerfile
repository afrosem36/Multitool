FROM node:20-slim

# Install yt-dlp and ffmpeg system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app
COPY package.json .
RUN npm install --omit=dev

COPY server.js .
COPY .env.example .env

EXPOSE 3001
CMD ["node", "server.js"]
