FROM node:20-alpine

WORKDIR /app

# wget is in busybox already, no extra install needed; keep image tiny
COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=8787
ENV DATA_DIR=/data
ENV MAX_SAVE_MB=100
ENV NODE_ENV=production

VOLUME ["/data"]
EXPOSE 8787

# 15s interval, 3s timeout, 10s grace at startup, fail after 3 misses.
# Combined with the `autoheal` sidecar in compose, a stuck process gets
# force-restarted, not just a crashed one.
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/health >/dev/null 2>&1 || exit 1

CMD ["node", "index.js"]
