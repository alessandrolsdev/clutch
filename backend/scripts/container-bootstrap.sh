#!/bin/sh

set -eu

npm run db:migrate:prod
npm run db:seed
