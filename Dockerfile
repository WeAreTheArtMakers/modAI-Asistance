FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV MODAI_WEB_HOST=0.0.0.0

EXPOSE 8787

CMD ["sh", "-c", "node modai/src/web/server.mjs --port ${PORT:-8787}"]
