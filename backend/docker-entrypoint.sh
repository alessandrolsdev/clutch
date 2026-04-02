#!/bin/sh

set -eu

mkdir -p /app/node_modules
chown -R node:node /app/node_modules

exec gosu node "$@"
