FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/lib ./lib
COPY --from=build /app/db ./db
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build /app/.env.example ./.env.example
EXPOSE 3000
CMD ["npm", "start"]
