FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src ./src
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
