import { authGuard } from '@api/guards/auth.guard';
import { instanceExistsGuard, instanceLoggedGuard } from '@api/guards/instance.guard';
import { ChannelRouter } from '@api/integrations/channel/channel.router';
import { EventRouter } from '@api/integrations/event/event.router';
import { StorageRouter } from '@api/integrations/storage/storage.router';
import { waMonitor } from '@api/server.module';
import { configService, Database } from '@config/env.config';
import { NextFunction, Request, Response, Router } from 'express';
import fs from 'fs';

import { ChatRouter } from './chat.router';
import { InstanceRouter } from './instance.router';
import { ProxyRouter } from './proxy.router';
import { MessageRouter } from './sendMessage.router';
import { SettingsRouter } from './settings.router';
import { TemplateRouter } from './template.router';

enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NOT_FOUND = 404,
  FORBIDDEN = 403,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  GONE = 410,
  INTERNAL_SERVER_ERROR = 500,
}

const router: Router = Router();
const serverConfig = configService.get('SERVER');
const databaseConfig = configService.get<Database>('DATABASE');
const guards = [instanceExistsGuard, instanceLoggedGuard, authGuard['apikey']];

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

// Middleware for metrics IP whitelist
const metricsIPWhitelist = (req: Request, res: Response, next: NextFunction) => {
  const metricsConfig = configService.get('METRICS');
  const allowedIPs = metricsConfig.ALLOWED_IPS?.split(',').map((ip) => ip.trim()) || ['127.0.0.1'];
  const clientIPs = [
    req.ip,
    req.connection.remoteAddress,
    req.socket.remoteAddress,
    req.headers['x-forwarded-for'],
  ].filter((ip) => ip !== undefined);

  if (allowedIPs.filter((ip) => clientIPs.includes(ip)) === 0) {
    return res.status(403).send('Forbidden: IP not allowed');
  }

  next();
};

// Middleware for metrics Basic Authentication
const metricsBasicAuth = (req: Request, res: Response, next: NextFunction) => {
  const metricsConfig = configService.get('METRICS');
  const metricsUser = metricsConfig.USER;
  const metricsPass = metricsConfig.PASSWORD;

  if (!metricsUser || !metricsPass) {
    return res.status(500).send('Metrics authentication not configured');
  }

  const auth = req.get('Authorization');
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Evolution API Metrics"');
    return res.status(401).send('Authentication required');
  }

  const credentials = Buffer.from(auth.slice(6), 'base64').toString();
  const [user, pass] = credentials.split(':');

  if (user !== metricsUser || pass !== metricsPass) {
    return res.status(401).send('Invalid credentials');
  }

  next();
};

// Expose Prometheus metrics when enabled by env flag
const metricsConfig = configService.get('METRICS');
if (metricsConfig.ENABLED) {
  const metricsMiddleware = [];

  // Add IP whitelist if configured
  if (metricsConfig.ALLOWED_IPS) {
    metricsMiddleware.push(metricsIPWhitelist);
  }

  // Add Basic Auth if required
  if (metricsConfig.AUTH_REQUIRED) {
    metricsMiddleware.push(metricsBasicAuth);
  }

  router.get('/metrics', ...metricsMiddleware, async (req, res) => {
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    const escapeLabel = (value: unknown) =>
      String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/"/g, '\\"');

    const lines: string[] = [];

    const clientName = databaseConfig.CONNECTION.CLIENT_NAME || 'unknown';
    const serverUrl = serverConfig.URL || '';

    // environment info
    lines.push('# HELP evolution_environment_info Environment information');
    lines.push('# TYPE evolution_environment_info gauge');
    lines.push(
      `evolution_environment_info{version="${escapeLabel(packageJson.version)}",clientName="${escapeLabel(
        clientName,
      )}",serverUrl="${escapeLabel(serverUrl)}"} 1`,
    );

    const instances = (waMonitor && waMonitor.waInstances) || {};
    const instanceEntries = Object.entries(instances);

    // total instances
    lines.push('# HELP evolution_instances_total Total number of instances');
    lines.push('# TYPE evolution_instances_total gauge');
    lines.push(`evolution_instances_total ${instanceEntries.length}`);

    // per-instance status
    lines.push('# HELP evolution_instance_up 1 if instance state is open, else 0');
    lines.push('# TYPE evolution_instance_up gauge');
    lines.push('# HELP evolution_instance_state Instance state as a labelled metric');
    lines.push('# TYPE evolution_instance_state gauge');

    for (const [name, instance] of instanceEntries) {
      const state = instance?.connectionStatus?.state || 'unknown';
      const integration = instance?.integration || '';
      const up = state === 'open' ? 1 : 0;

      lines.push(
        `evolution_instance_up{instance="${escapeLabel(name)}",integration="${escapeLabel(integration)}"} ${up}`,
      );
      lines.push(
        `evolution_instance_state{instance="${escapeLabel(name)}",integration="${escapeLabel(
          integration,
        )}",state="${escapeLabel(state)}"} 1`,
      );
    }

    res.send(lines.join('\n') + '\n');
  });
}

/**
 * Surfaces removed in Phase 2. They answer 410 rather than 404 so an existing
 * consumer gets told the endpoint is gone for good, not that it mistyped a URL.
 *
 * `/group`, `/label`, `/call`, `/business` and `/baileys` were WhatsApp Web
 * only — no Meta channel exposes a usable group thread or socket passthrough.
 * The chatbot surfaces are business domain, which a gateway does not own.
 * `/manager` served the removed admin UI. `POST /verify-creds` returned a
 * Facebook user token in the response body.
 */
const goneRoutes = [
  '/group',
  '/label',
  '/call',
  '/business',
  '/baileys',
  '/manager',
  '/assets',
  '/verify-creds',
  '/chatwoot',
  '/typebot',
  '/openai',
  '/dify',
  '/flowise',
  '/n8n',
  '/evoai',
  '/evolutionBot',
  '/rabbitmq',
  '/nats',
  '/sqs',
  '/pusher',
  '/kafka',
];

for (const gone of goneRoutes) {
  router.use(gone, (_req, res) =>
    res.status(HttpStatus.GONE).json({
      status: HttpStatus.GONE,
      error: 'Gone',
      message: `${gone} was removed in Nexo API. See the migration notes in the README.`,
    }),
  );
}

router
  .get('/', async (req, res) => {
    res.status(HttpStatus.OK).json({
      status: HttpStatus.OK,
      message: 'Welcome to the Nexo API, it is working!',
      version: packageJson.version,
      clientName: databaseConfig.CONNECTION.CLIENT_NAME,
      poweredBy: 'Evolution API',
    });
  })
  .use('/instance', new InstanceRouter(configService, ...guards).router)
  .use('/message', new MessageRouter(...guards).router)
  .use('/chat', new ChatRouter(...guards).router)
  .use('/template', new TemplateRouter(configService, ...guards).router)
  .use('/settings', new SettingsRouter(...guards).router)
  .use('/proxy', new ProxyRouter(...guards).router)
  .use('', new ChannelRouter(configService).router)
  .use('', new EventRouter(configService, ...guards).router)
  .use('', new StorageRouter(...guards).router);

export { HttpStatus, router };
