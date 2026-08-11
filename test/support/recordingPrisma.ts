/**
 * A PrismaRepository stand-in that records every write and answers reads from a
 * seeded fixture. It exists so the golden-file suite can observe exactly which
 * rows the Meta channel would produce, without a database.
 *
 * Reads return `null` by default. Anything the channel reads and branches on is
 * seeded explicitly, so an unseeded read shows up as a behaviour change rather
 * than passing silently.
 */

export type RecordedWrite = {
  model: string;
  op: string;
  args: unknown;
};

export type PrismaSeed = {
  /** Rows returned by `setting.findUnique`. */
  setting?: Record<string, unknown> | null;
  /** `message.findFirst` results keyed by the wamid being looked up. */
  messagesByKeyId?: Record<string, Record<string, unknown>>;
  /** Row returned by `contact.findFirst`, or null for "new contact". */
  contact?: Record<string, unknown> | null;
};

export type RecordingPrisma = {
  writes: RecordedWrite[];
  repository: Record<string, unknown>;
};

/**
 * Deep clone at record time. `messageRaw` is mutated after being handed to
 * Prisma (chatwoot ids, media ids), so holding the reference would let later
 * mutations rewrite history.
 */
const snapshot = <T>(value: T): T => (value === undefined ? value : structuredClone(value));

let idCounter = 0;
const nextId = () => `rec_${String(++idCounter).padStart(4, '0')}`;

export function resetIdCounter(): void {
  idCounter = 0;
}

export function createRecordingPrisma(seed: PrismaSeed = {}): RecordingPrisma {
  const writes: RecordedWrite[] = [];

  const record = (model: string, op: string, args: unknown) => {
    writes.push({ model, op, args: snapshot(args) });
  };

  const writeModel = (model: string) => ({
    create: async (args: any) => {
      record(model, 'create', args);
      return { id: nextId(), ...snapshot(args?.data) };
    },
    update: async (args: any) => {
      record(model, 'update', args);
      return { id: nextId(), ...snapshot(args?.data) };
    },
    updateMany: async (args: any) => {
      record(model, 'updateMany', args);
      return { count: 1 };
    },
    upsert: async (args: any) => {
      record(model, 'upsert', args);
      return { id: nextId(), ...snapshot(args?.create ?? args?.update) };
    },
    delete: async (args: any) => {
      record(model, 'delete', args);
      return { id: nextId() };
    },
  });

  const repository: Record<string, any> = {
    setting: {
      ...writeModel('setting'),
      findUnique: async () => snapshot(seed.setting ?? null),
      findFirst: async () => snapshot(seed.setting ?? null),
    },
    chatwoot: {
      ...writeModel('chatwoot'),
      findUnique: async () => null,
      findFirst: async () => null,
    },
    message: {
      ...writeModel('message'),
      findFirst: async (args: any) => {
        const keyId = args?.where?.key?.equals;
        const found = seed.messagesByKeyId?.[keyId];
        return found ? snapshot(found) : null;
      },
      findMany: async () => [],
    },
    media: writeModel('media'),
    messageUpdate: writeModel('messageUpdate'),
    contact: {
      ...writeModel('contact'),
      findFirst: async () => snapshot(seed.contact ?? null),
      findMany: async () => [],
    },
    chat: {
      ...writeModel('chat'),
      findFirst: async () => null,
      findMany: async () => [],
    },
    instance: {
      ...writeModel('instance'),
      findFirst: async () => null,
      findUnique: async () => null,
    },
    template: {
      ...writeModel('template'),
      findFirst: async () => null,
    },
    openaiSetting: {
      ...writeModel('openaiSetting'),
      findFirst: async () => null,
    },
    openaiCreds: {
      ...writeModel('openaiCreds'),
      findUnique: async () => null,
    },
  };

  return { writes, repository };
}
