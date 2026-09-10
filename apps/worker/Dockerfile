FROM node:22.19-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/worker/package.json apps/worker/package.json
RUN npm ci
COPY apps/worker apps/worker
RUN npm run build -w @atlas/worker
USER node
CMD ["node","apps/worker/dist/main.js"]
