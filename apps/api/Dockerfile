FROM node:22.19-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci
COPY apps/api apps/api
COPY packages/contracts packages/contracts
RUN npm run build -w @atlas/api
FROM node:22.19-alpine
USER node
WORKDIR /app
COPY --from=build /app /app
CMD ["node","apps/api/dist/main.js"]
