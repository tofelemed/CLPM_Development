FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src ./src
EXPOSE 4840
CMD ["node", "src/server.js"]
