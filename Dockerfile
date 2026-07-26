# ------------------------------------------------------------------
# Pétanque Concours — image de production (client + API dans un conteneur)
# ------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/package.json server/
COPY --from=build /app/client/dist client/dist
COPY --from=build /app/node_modules node_modules
EXPOSE 8787
VOLUME /app/server/data
CMD ["node", "server/dist/index.js"]
