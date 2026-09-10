FROM node:22.19-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run db:generate
RUN npm run build -w @atlas/api
RUN npm prune --omit=dev
FROM node:22.19-alpine
USER node
WORKDIR /app
COPY --from=build /app /app
CMD ["node","apps/api/dist/src/main.js"]
