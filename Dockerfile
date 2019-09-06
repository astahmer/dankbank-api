FROM node:10-alpine

WORKDIR /usr/app

COPY package.json .
RUN npm config set registry http://registry.npmjs.org
RUN npm install --no-progress --ignore-optional

COPY . .
EXPOSE 3000
EXPOSE 9229
