FROM node:24-alpine AS builder

RUN apk update && \
    apk add --no-cache git ffmpeg wget curl bash openssl

LABEL description="Meta Tech Provider messaging gateway for WhatsApp Cloud API, Instagram Direct and Messenger."
LABEL maintainer="Tiago Follador" git="https://github.com/TiagoFollador"

WORKDIR /nexo

COPY ./package*.json ./
COPY ./tsconfig.json ./
COPY ./tsup.config.ts ./

RUN npm ci --silent

COPY ./src ./src
COPY ./prisma ./prisma
COPY ./.env.example ./.env

COPY ./Docker ./Docker

RUN chmod +x ./Docker/scripts/* && dos2unix ./Docker/scripts/*

RUN ./Docker/scripts/generate_database.sh

RUN npm run build

FROM node:24-alpine AS final

RUN apk update && \
    apk add tzdata ffmpeg bash openssl

ENV TZ=America/Sao_Paulo
ENV DOCKER_ENV=true

WORKDIR /nexo

COPY --from=builder /nexo/package.json ./package.json
COPY --from=builder /nexo/package-lock.json ./package-lock.json

COPY --from=builder /nexo/node_modules ./node_modules
COPY --from=builder /nexo/dist ./dist
COPY --from=builder /nexo/prisma ./prisma
COPY --from=builder /nexo/.env ./.env
COPY --from=builder /nexo/Docker ./Docker
COPY --from=builder /nexo/tsup.config.ts ./tsup.config.ts

ENV DOCKER_ENV=true

EXPOSE 8080

ENTRYPOINT ["/bin/bash", "-c", ". ./Docker/scripts/deploy_database.sh && npm run start:prod" ]
