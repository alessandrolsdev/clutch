#!/bin/sh

set -eu

# The backend source is bind-mounted in development and node_modules lives in a
# persistent Docker volume. Reinstalling + regenerating Prisma on boot keeps the
# volume aligned with the current image/runtime after base-image or lockfile changes.
npm install
npx prisma generate
npm run db:migrate:prod
npm run db:seed
npm run dev
