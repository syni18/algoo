# Use official Node.js runtime as a parent image
FROM node:18-alpine

WORKDIR /app

# Copy package files and install ALL dependencies (including dev)
COPY ../package*.json ./
RUN npm install

# Copy app source and configs
COPY ../src ./src
COPY ../.env .env
COPY ../tsconfig.json .
COPY ../ecosystem.config.cjs .
COPY ../webpack.config.ts .
COPY ../certs/localhost-key.pem ./certs/
COPY ../certs/localhost.pem ./certs/

# Build the project
RUN npm run build

# OPTIONAL: Remove devDependencies after build to slim image
RUN npm prune --production

EXPOSE 8888

CMD ["node", "dist/server.js"]
