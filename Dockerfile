FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM base AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/node_modules ./node_modules
COPY --from=build /app ./
EXPOSE 3000
CMD ["node", "index.js"]
