import { WebhookController } from '@api/integrations/event/webhook/webhook.controller';
import { WebsocketController } from '@api/integrations/event/websocket/websocket.controller';
import { PrismaRepository } from '@api/repository/repository.service';
import { WAMonitoringService } from '@api/services/monitor.service';
import { Server } from 'http';

/**
 * Fanout across the two transports Nexo API keeps: webhook (the consumer
 * contract) and websocket. RabbitMQ, NATS, SQS, Pusher and Kafka were removed
 * in Phase 2 — a gateway does not need five queue clients.
 */
export class EventManager {
  private prismaRepository: PrismaRepository;
  private waMonitor: WAMonitoringService;
  private websocketController: WebsocketController;
  private webhookController: WebhookController;

  constructor(prismaRepository: PrismaRepository, waMonitor: WAMonitoringService) {
    this.prisma = prismaRepository;
    this.monitor = waMonitor;

    this.websocket = new WebsocketController(prismaRepository, waMonitor);
    this.webhook = new WebhookController(prismaRepository, waMonitor);
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

  public set websocket(websocket: WebsocketController) {
    this.websocketController = websocket;
  }

  public get websocket() {
    return this.websocketController;
  }

  public set webhook(webhook: WebhookController) {
    this.webhookController = webhook;
  }

  public get webhook() {
    return this.webhookController;
  }

  public init(httpServer: Server): void {
    this.websocket.init(httpServer);
  }

  public async emit(eventData: {
    instanceName: string;
    origin: string;
    event: string;
    data: object;
    serverUrl: string;
    dateTime: string;
    sender: string;
    apiKey?: string;
    local?: boolean;
    integration?: string[];
    extra?: Record<string, any>;
  }): Promise<void> {
    await this.websocket.emit(eventData);
    await this.webhook.emit(eventData);
  }

  public async setInstance(instanceName: string, data: any): Promise<any> {
    if (data.websocket) {
      await this.websocket.set(instanceName, {
        websocket: {
          enabled: true,
          events: data.websocket?.events,
        },
      });
    }

    if (data.webhook) {
      await this.webhook.set(instanceName, {
        webhook: {
          enabled: true,
          events: data.webhook?.events,
          url: data.webhook?.url,
          headers: data.webhook?.headers,
          base64: data.webhook?.base64,
          byEvents: data.webhook?.byEvents,
        },
      });
    }
  }
}
