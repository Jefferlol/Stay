FROM node:20-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json ./
RUN npm install --production

# Copy application files
COPY . .

# Ensure data directory exists
RUN mkdir -p data

EXPOSE 3000

CMD ["node", "server.js"]
