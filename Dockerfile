# Debian slim (glibc) so better-sqlite3 installs a prebuilt binary — no compiler needed.
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
