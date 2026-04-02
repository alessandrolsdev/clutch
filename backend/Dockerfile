FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates gosu \
  && npm install --global tsx@4.20.6 \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN mkdir -p /app/node_modules \
  && chown -R node:node /app

EXPOSE 3344

ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
