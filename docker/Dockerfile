# Set the base image.
FROM node:10-alpine

WORKDIR /usr/app

# Only copy necessary files
COPY webpack.config.js tsconfig.json package*.json ./
COPY ./src ./src

# Expose app & debug
EXPOSE 3000
EXPOSE 9229