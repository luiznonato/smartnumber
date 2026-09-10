FROM node:22.19-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run db:generate
RUN npm run build -w @atlas/worker
RUN npm prune --omit=dev
USER node
CMD ["node","apps/worker/dist/main.js"]
