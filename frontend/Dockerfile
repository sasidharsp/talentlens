FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx template — BACKEND_URL is substituted at container start
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

# envsubst replaces ${BACKEND_URL} only — leaves nginx vars ($uri, $host etc) untouched
CMD ["/bin/sh", "-c", \
  "envsubst '$BACKEND_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
