FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=optional

COPY . .

EXPOSE 4100

CMD ["npm", "run", "blockchain-service"]
