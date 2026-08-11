import { configService } from '@config/env.config';
import EventEmitter2 from 'eventemitter2';

import { createRecordingPrisma, type PrismaSeed, type RecordedWrite, resetIdCounter } from './recordingPrisma';

export const INSTANCE_NAME = 'golden-instance';
export const INSTANCE_ID = 'inst_golden_0001';
export const PHONE_NUMBER_ID = '109876543210987';

export type CapturedEvent = { event: string; data: unknown };

export type Harness = {
  service: any;
  writes: RecordedWrite[];
  events: CapturedEvent[];
  /** Errors surfaced by `connectToWhatsapp`, in delivery order. */
  thrown: string[];
  /** Feeds a webhook payload through the real entrypoint and lets it settle. */
  deliver: (payload: unknown) => Promise<void>;
};

const noopCache = () =>
  ({
    get: async () => null,
    set: async () => undefined,
    has: async () => false,
    delete: async () => undefined,
    deleteAll: async () => undefined,
    hGet: async () => null,
    hSet: async () => undefined,
    hDelete: async () => undefined,
    keys: async () => [],
  }) as any;

/**
 * `eventHandler` and `messageHandle` are both invoked without `await`, so the
 * work outlives `connectToWhatsapp`. Yield repeatedly to let those detached
 * promise chains finish before assertions run.
 */
async function settle(ticks = 25): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

export async function createMetaHarness(seed: PrismaSeed = {}): Promise<Harness> {
  resetIdCounter();

  // Imported lazily so test env vars from setup/env.ts are already in place
  // when the module graph (and its config singleton) is constructed.
  const { BusinessStartupService } = await import('@api/integrations/channel/meta/whatsapp.business.service');

  const { writes, repository } = createRecordingPrisma(seed);

  const service: any = new BusinessStartupService(configService, new EventEmitter2(), repository as any, noopCache());

  service.setInstance({
    instanceName: INSTANCE_NAME,
    instanceId: INSTANCE_ID,
    integration: 'WHATSAPP-BUSINESS',
    number: PHONE_NUMBER_ID,
    token: 'GRAPH_ACCESS_TOKEN',
  });

  const events: CapturedEvent[] = [];
  service.sendDataWebhook = async (event: string, data: unknown) => {
    events.push({ event, data: structuredClone(data) });
  };

  // Quiet the channel's pino logger; the golden output is the assertion.
  for (const level of ['log', 'info', 'warn', 'error', 'verbose', 'debug'] as const) {
    service.logger[level] = () => undefined;
  }

  const thrown: string[] = [];

  return {
    service,
    writes,
    events,
    thrown,
    deliver: async (payload: unknown) => {
      // Some payloads make the current implementation throw (a
      // message_template_status_update reaches `content.statuses[0]` with no
      // statuses array). That is behaviour worth pinning, not hiding.
      try {
        await service.connectToWhatsapp(payload);
      } catch (error: any) {
        thrown.push(String(error?.message ?? error));
      }
      await settle();
    },
  };
}
