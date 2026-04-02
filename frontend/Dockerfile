FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache su-exec

COPY package*.json ./
RUN npm install

COPY . .
RUN mkdir -p /app/.next /app/node_modules \
  && chown -R node:node /app

EXPOSE 3000

ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
