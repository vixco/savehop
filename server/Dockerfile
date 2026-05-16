FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=8787
ENV DATA_DIR=/data
ENV MAX_SAVE_MB=100

VOLUME ["/data"]
EXPOSE 8787

CMD ["node", "index.js"]
