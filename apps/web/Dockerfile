FROM node:22.19-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build -w @atlas/web
FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/out /usr/share/nginx/html
