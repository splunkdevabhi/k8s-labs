# Stage 1: Build the React application
FROM node:18-alpine AS build

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the application using a lightweight server
FROM node:18-alpine

WORKDIR /app

# Install serve globally
RUN npm install -g serve

# Copy the build output from the build stage
COPY --from=build /app/build ./build

# Expose port 3000
EXPOSE 3000

# Serve the build directory
CMD ["serve", "-s", "build", "-l", "3000"] 