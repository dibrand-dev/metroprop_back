# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# problemas de memoria por ser una instancia small
ENV NODE_OPTIONS=--max-old-space-size=1024
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# problemas de memoria por ser una instancia small
ENV NODE_OPTIONS=--max-old-space-size=1024
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]