FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm cache clean --force && npm ci

COPY . .

ARG VITE_BACKEND_URL=
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Copy as a template — envsubst fills in $BACKEND_URL at container start
COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template

# Default: Docker Compose internal hostname. Override in Railway dashboard.
ENV BACKEND_URL=http://backend:8000

EXPOSE 80

# Substitute env vars into the nginx template, then start nginx
CMD ["/bin/sh", "-c", \
  "envsubst '$BACKEND_URL' < /etc/nginx/conf.d/default.conf.template \
   > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
