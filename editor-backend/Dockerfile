# Use a stable Node.js version as the base image
FROM node:18-bullseye

# Set working dir
WORKDIR /app

# Install system dependencies required for compiling and running code
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    default-jre \
    default-jdk \
    python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install --production=false

# Copy application source
COPY . .

# Expose port
EXPOSE 8080

# Optional: a simple healthcheck so Docker can mark container unhealthy quickly
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start in dev mode (nodemon) if your package.json provides "dev" script.
# If you want production start, change to: CMD ["npm","start"]
CMD ["npm", "run", "dev"]
