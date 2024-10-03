# Use the official Node.js image as a base
FROM node:18-alpine

# Install dependencies needed for building native addons (canvas, node-gyp)
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port app runs on
EXPOSE 8000

# Start the application
CMD ["npm", "start"]

