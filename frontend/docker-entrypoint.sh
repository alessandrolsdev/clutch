#!/bin/sh

set -eu

mkdir -p /app/node_modules /app/.next
chown -R node:node /app/node_modules /app/.next

exec su-exec node "$@"
