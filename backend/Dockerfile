FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/ .

EXPOSE 5000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressuser
USER expressuser

CMD ["node", "server.js"]
