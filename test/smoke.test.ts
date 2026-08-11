import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('resolves tsconfig path aliases', async () => {
    const { Events } = await import('@api/types/wa.types');
    expect(Events.MESSAGES_UPSERT).toBe('messages.upsert');
  });
});
