# Set the base image.
FROM node:10-alpine

WORKDIR /usr/app

# Only copy necessary files
COPY webpack.config.js tsconfig.json package*.json ./
COPY ./src ./src

RUN mkdir -p /usr/src/node_modules
ENV PATH /usr/app/node_modules/.bin:$PATH

# Expose app & debug
EXPOSE 3000
EXPOSE 9229
