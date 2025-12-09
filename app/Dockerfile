FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx svelte-kit sync
RUN npm run build

FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .
RUN npm prune --omit=dev
EXPOSE 3000
ENV NODE_ENV=production
# Needs adapter-node to be configured in svelte.config.js
CMD [ "node", "build" ]
