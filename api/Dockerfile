FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY server.js app.js ./

USER node
ENV SERVE_STATIC=0
EXPOSE 3001

CMD ["node", "server.js"]
