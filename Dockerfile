# SOS WALLETS — Dockerfile for Railway / any container platform
# Uses Node.js 20 slim image

FROM node:20-slim

# Install build tools for better-sqlite3 native compilation (just in case prebuilt fails)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy backend package files first (for better caching)
COPY backend/package.json backend/package-lock.json* backend/.npmrc ./backend/

# Install backend dependencies
RUN cd backend && npm install

# Copy all project files (frontend + backend)
COPY . .

# The backend serves the frontend from the parent directory (../)
# so we need the frontend files at /app/ and backend at /app/backend/

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Expose port (Railway sets PORT env automatically)
EXPOSE ${PORT}

# Start the server
WORKDIR /app/backend
CMD ["node", "server.js"]
