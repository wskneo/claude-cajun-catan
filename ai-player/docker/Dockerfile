# ---- Builder Stage ----
# This stage installs all dependencies, builds the TypeScript code,
# and prepares the final assets.
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy the rest of the source code
COPY . .

# Compile TypeScript to JavaScript
RUN npm run build

# ---- Production Stage ----
# This stage creates the final, lightweight image with only the
# necessary production files.
FROM node:18-alpine

WORKDIR /app

# Install system dependencies needed for runtime
RUN apk add --no-cache curl

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy the compiled code from the builder stage
COPY --from=builder /app/dist ./dist

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S catan-ai -u 1001

# Switch to the non-root user
USER catan-ai

# Expose the application port
EXPOSE 3001

# Add a health check to ensure the service is running
# You might need to create a /health endpoint in your Express app
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Define the command to start the application
CMD ["node", "dist/index.js"]