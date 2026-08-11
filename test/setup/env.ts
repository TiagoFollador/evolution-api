// Minimal environment for importing the app module graph inside tests.
// Nothing here opens a socket: Prisma and the cache engine only connect lazily,
// and every test replaces them with recording doubles.
process.env.DATABASE_PROVIDER ??= 'postgresql';
process.env.DATABASE_CONNECTION_URI ??= 'postgresql://nexo:nexo@127.0.0.1:5432/nexo_test?schema=public';
process.env.DATABASE_CONNECTION_CLIENT_NAME ??= 'nexo_test';
process.env.AUTHENTICATION_API_KEY ??= 'test-global-apikey';
process.env.CACHE_REDIS_ENABLED ??= 'false';
process.env.CACHE_LOCAL_ENABLED ??= 'false';
process.env.CHATWOOT_ENABLED ??= 'false';
process.env.S3_ENABLED ??= 'false';
process.env.OPENAI_ENABLED ??= 'false';
process.env.RABBITMQ_ENABLED ??= 'false';
process.env.SQS_ENABLED ??= 'false';
process.env.WEBSOCKET_ENABLED ??= 'false';
process.env.LOG_LEVEL ??= 'ERROR';
process.env.LOG_BAILEYS ??= 'error';
process.env.SENTRY_DSN ??= '';
