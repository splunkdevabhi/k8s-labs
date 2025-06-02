FROM node:18-alpine

WORKDIR /usr/src/app

# Install build dependencies
RUN apk add --no-cache python3 make g++

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3001

ENV NODE_ENV production

CMD ["node", "index.js"]