FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src
COPY scripts ./scripts
COPY .env ./

ENV NODE_ENV=production
CMD ["npm", "start"]
