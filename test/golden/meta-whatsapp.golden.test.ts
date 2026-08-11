import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { createMetaHarness } from '../support/metaChannelHarness';

/**
 * Golden-file suite for the Meta WhatsApp channel.
 *
 * These snapshots capture the CURRENT behaviour of `BusinessStartupService`,
 * bugs included — the stale `this.phoneNumber` used as `key.remoteJid`, the
 * `changes[0]`-only read, the status loop that aborts a batch on an unknown
 * wamid. That is deliberate: Phases 1-3 are refactors and must not change any
 * of it, so an unexpected diff here is a regression.
 *
 * Phase 5 fixes those bugs. The snapshots are expected to be rewritten then,
 * in the same commit as the fix, and reviewed as part of it.
 */

const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'meta', 'whatsapp');

const fixtureNames = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

const loadFixture = (name: string) => JSON.parse(readFileSync(join(FIXTURE_DIR, `${name}.json`), 'utf8'));

/**
 * Known wamids for the status fixtures. `status-unknown-wamid` intentionally
 * leads with an id absent from this map.
 */
const seededMessages = {
  'wamid.KNOWN0001': { id: 'msg_known_0001', key: { id: 'wamid.KNOWN0001' }, webhookUrl: null },
  'wamid.KNOWN0002': { id: 'msg_known_0002', key: { id: 'wamid.KNOWN0002' }, webhookUrl: null },
};

describe('Meta WhatsApp channel — recorded behaviour', () => {
  it('covers every fixture in the corpus', () => {
    expect(fixtureNames.length).toBeGreaterThan(0);
  });

  for (const name of fixtureNames) {
    it(`produces stable writes and events for "${name}"`, async () => {
      const harness = await createMetaHarness({
        setting: null,
        contact: null,
        messagesByKeyId: seededMessages,
      });

      await harness.deliver(loadFixture(name));

      expect({
        writes: harness.writes,
        events: harness.events,
        thrown: harness.thrown,
        phoneNumberAfter: harness.service.phoneNumber ?? null,
      }).toMatchSnapshot();
    });
  }
});

describe('Meta WhatsApp channel — cross-contact batch', () => {
  /**
   * Two inbound messages from different contacts, delivered back to back on one
   * service instance. `this.phoneNumber` is instance state assigned *after*
   * `eventHandler` runs, so the second message is attributed using the first
   * contact's jid. Snapshot records that misattribution.
   */
  it('records how sequential webhooks from different contacts are attributed', async () => {
    const harness = await createMetaHarness({ setting: null, contact: null });

    const ana = loadFixture('text');
    const bruno = {
      ...ana,
      entry: [
        {
          ...ana.entry[0],
          changes: [
            {
              field: 'messages',
              value: {
                ...ana.entry[0].changes[0].value,
                contacts: [{ profile: { name: 'Bruno Lima', phone: '5521999998888' }, wa_id: '5521999998888' }],
                messages: [
                  {
                    from: '5521999998888',
                    id: 'wamid.CROSS0002',
                    timestamp: '1754871200',
                    type: 'text',
                    text: { body: 'mensagem do Bruno' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    await harness.deliver(ana);
    await harness.deliver(bruno);

    const remoteJids = harness.writes
      .filter((w) => w.model === 'message' && w.op === 'create')
      .map((w) => (w.args as any).data.key);

    expect(remoteJids).toMatchSnapshot();
  });

  /**
   * The same two contacts, delivered concurrently — which is what production
   * does: `meta.controller.ts:39` fires `entry.forEach(async …)` with no await.
   * `this.phoneNumber` is a single mutable field, so the interleaving decides
   * which contact each message is attributed to.
   *
   * Phase 5 must make this snapshot show each message under its own contact.
   */
  it('records cross-contact attribution under concurrent delivery', async () => {
    const harness = await createMetaHarness({ setting: null, contact: null });

    const base = loadFixture('batch-multi-entry');
    const forEntry = (index: number) => ({ object: base.object, entry: [base.entry[index]] });

    await Promise.all([
      harness.service.connectToWhatsapp(forEntry(0)),
      harness.service.connectToWhatsapp(forEntry(1)),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const attribution = harness.writes
      .filter((w) => w.model === 'message' && w.op === 'create')
      .map((w) => {
        const data = (w.args as any).data;
        return { id: data.key.id, remoteJid: data.key.remoteJid, pushName: data.pushName };
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    expect(attribution).toMatchSnapshot();
  });
});
