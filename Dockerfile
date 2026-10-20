FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node src ./src
COPY --chown=node:node docker/*.js ./docker/
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node test ./test
USER node
EXPOSE 4000
CMD ["node", "src/server.js"]
