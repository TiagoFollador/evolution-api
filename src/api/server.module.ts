import { CacheEngine } from '@cache/cacheengine';
import { configService } from '@config/env.config';
import { eventEmitter } from '@config/event.config';
import { Logger } from '@config/logger.config';

import { ChatController } from './controllers/chat.controller';
import { InstanceController } from './controllers/instance.controller';
import { ProxyController } from './controllers/proxy.controller';
import { SendMessageController } from './controllers/sendMessage.controller';
import { SettingsController } from './controllers/settings.controller';
import { TemplateController } from './controllers/template.controller';
import { ChannelController } from './integrations/channel/channel.controller';
import { MetaController } from './integrations/channel/meta/meta.controller';
import { EventManager } from './integrations/event/event.manager';
import { S3Controller } from './integrations/storage/s3/controllers/s3.controller';
import { S3Service } from './integrations/storage/s3/services/s3.service';
import { PrismaRepository } from './repository/repository.service';
import { CacheService } from './services/cache.service';
import { WAMonitoringService } from './services/monitor.service';
import { ProxyService } from './services/proxy.service';
import { SettingsService } from './services/settings.service';
import { TemplateService } from './services/template.service';

const logger = new Logger('WA MODULE');

export const cache = new CacheService(new CacheEngine(configService, 'instance').getEngine());

export const prismaRepository = new PrismaRepository(configService);

export const waMonitor = new WAMonitoringService(eventEmitter, configService, prismaRepository, cache);

const s3Service = new S3Service(prismaRepository);
export const s3Controller = new S3Controller(s3Service);

const templateService = new TemplateService(waMonitor, prismaRepository, configService);
export const templateController = new TemplateController(templateService);

const proxyService = new ProxyService(waMonitor);
export const proxyController = new ProxyController(proxyService, waMonitor);

const settingsService = new SettingsService(waMonitor);
export const settingsController = new SettingsController(settingsService);

export const instanceController = new InstanceController(
  waMonitor,
  configService,
  prismaRepository,
  eventEmitter,
  settingsService,
  proxyController,
  cache,
);
export const sendMessageController = new SendMessageController(waMonitor);
export const chatController = new ChatController(waMonitor);

export const eventManager = new EventManager(prismaRepository, waMonitor);
export const channelController = new ChannelController(prismaRepository, waMonitor);

// channels
export const metaController = new MetaController(prismaRepository, waMonitor);

logger.info('Module - ON');
