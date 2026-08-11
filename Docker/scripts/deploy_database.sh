#!/bin/bash

source ./Docker/scripts/env_functions.sh

if [ "$DOCKER_ENV" != "true" ]; then
    export_env_vars
fi

# Nexo API is Postgres-only: one schema, one migration tree, no provider switch.
export DATABASE_URL
echo "Deploying migrations"
npm run db:deploy
if [ $? -ne 0 ]; then
    echo "Migration failed"
    exit 1
else
    echo "Migration succeeded"
fi
npm run db:generate
if [ $? -ne 0 ]; then
    echo "Prisma generate failed"
    exit 1
else
    echo "Prisma generate succeeded"
fi
