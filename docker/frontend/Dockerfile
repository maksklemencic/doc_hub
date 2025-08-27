FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Set environment variables for hot reload
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true
ENV NEXT_TELEMETRY_DISABLED=1

# Expose port
EXPOSE 3000

# Start the development server with hot reload
# Note: The source code is mounted as volume, so we don't copy it here
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]