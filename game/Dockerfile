FROM node:current-buster

RUN mkdir -p /apps/president
WORKDIR /apps/president
COPY src .
COPY public ./public
COPY views ./views

RUN npm install
CMD ./wait-for-it.sh -s -t 0 "$LOGSTASH_URL" -- node president.js
