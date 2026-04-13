#!/bin/sh

set -eu

UPLOADS_DIR="${MEDIA_UPLOADS_DIR:-/data/uploads/images}"
UPLOADS_BASE_DIR="$(dirname "$UPLOADS_DIR")"

mkdir -p /app/node_modules
mkdir -p "$UPLOADS_DIR"
chown -R node:node /app/node_modules "$UPLOADS_BASE_DIR"

exec gosu node "$@"
