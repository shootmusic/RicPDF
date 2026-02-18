FROM node:18-bullseye

WORKDIR /app

# Copy semua file (bukan cuma backend)
COPY . .

# Install dependencies
RUN cd backend && npm install

EXPOSE 3000

CMD ["node", "backend/server.js"]
