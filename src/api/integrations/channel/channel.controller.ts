import { InstanceDto } from '@api/dto/instance.dto';
import { PrismaRepository } from '@api/repository/repository.service';
import { CacheService } from '@api/services/cache.service';
import { WAMonitoringService } from '@api/services/monitor.service';
import { Integration } from '@api/types/wa.types';
import { ConfigService } from '@config/env.config';
import { BadRequestException } from '@exceptions';
import EventEmitter2 from 'eventemitter2';

import { BusinessStartupService } from './meta/whatsapp.business.service';

type ChannelDataType = {
  configService: ConfigService;
  eventEmitter: EventEmitter2;
  prismaRepository: PrismaRepository;
  cache: CacheService;
};

export interface ChannelControllerInterface {
  receiveWebhook(data: any): Promise<any>;
}

export class ChannelController {
  public prismaRepository: PrismaRepository;
  public waMonitor: WAMonitoringService;

  constructor(prismaRepository: PrismaRepository, waMonitor: WAMonitoringService) {
    this.prisma = prismaRepository;
    this.monitor = waMonitor;
  }

  public set prisma(prisma: PrismaRepository) {
    this.prismaRepository = prisma;
  }

  public get prisma() {
    return this.prismaRepository;
  }

  public set monitor(waMonitor: WAMonitoringService) {
    this.waMonitor = waMonitor;
  }

  public get monitor() {
    return this.waMonitor;
  }

  public init(instanceData: InstanceDto, data: ChannelDataType) {
    if (instanceData.integration !== Integration.WHATSAPP_BUSINESS) {
      return null;
    }

    if (!instanceData.token) {
      throw new BadRequestException('token is required');
    }

    return new BusinessStartupService(data.configService, data.eventEmitter, data.prismaRepository, data.cache);
  }
}
