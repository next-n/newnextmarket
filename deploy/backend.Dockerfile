FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend-api/package.json apps/backend-api/package.json
RUN npm ci

COPY apps/backend-api apps/backend-api
RUN npx prisma generate --schema apps/backend-api/prisma/schema.prisma
RUN npm run backend:build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json package.json
COPY --from=build /app/package-lock.json package-lock.json
COPY --from=build /app/apps/backend-api/package.json apps/backend-api/package.json
COPY --from=build /app/apps/backend-api/dist apps/backend-api/dist
COPY --from=build /app/apps/backend-api/prisma apps/backend-api/prisma

EXPOSE 3000
CMD ["node", "apps/backend-api/dist/src/main.js"]
