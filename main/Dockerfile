# Use the official Node.js image based on Alpine Linux from the Docker Hub
FROM node:22.13-alpine

LABEL org.opencontainers.image.authors="Alfred Mah <alfredmjz@gmail.com>"

# Create and change to the app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

RUN npm run build

# Expose the port
EXPOSE 3000

# Define the command to run the application
CMD ["npm", "start"]