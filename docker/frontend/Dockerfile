FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Expose port
EXPOSE 3000

# Start the development server with hot reload
# Note: The source code is mounted as volume, so we don't copy it here
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]