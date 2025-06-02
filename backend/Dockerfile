# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Install build dependencies for node-pty/node-gyp
RUN apk add --no-cache python3 make g++

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install app dependencies
RUN npm install

# Bundle app source
COPY . .

# Make port 3001 available to the world outside this container
EXPOSE 3001

# Define environment variable
ENV NODE_ENV production

# Run index.js when the container launches
CMD ["node", "index.js"]