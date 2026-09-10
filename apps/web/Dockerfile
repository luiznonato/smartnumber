FROM node:22.19-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci
COPY apps/web apps/web
COPY packages/ui packages/ui
RUN npm run build -w @atlas/web
FROM node:22.19-alpine
WORKDIR /app
ENV NODE_ENV=production
USER node
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
CMD ["node","apps/web/server.js"]
