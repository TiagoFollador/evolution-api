/**
 * Transport-neutral contracts that used to be imported from `baileys`.
 *
 * These are the only shapes the shared layer (DTOs, domain types, cache) ever
 * needed from that package, and none of them are WhatsApp Web specific. Owning
 * them locally is what lets the Baileys channel be deleted without dragging the
 * whole DTO surface with it.
 */

/**
 * A reference to a message already known to the channel — quoting, reacting,
 * deleting. Mirrors the fields of the former `proto.IMessageKey` that this
 * codebase actually reads.
 */
export type MessageKeyRef = {
  id?: string | null;
  remoteJid?: string | null;
  fromMe?: boolean | null;
  participant?: string | null;
};

/** Body of a quoted message. Channel-specific and unvalidated at this layer. */
export type MessageContentRef = Record<string, any>;

export type PresenceState = 'unavailable' | 'available' | 'composing' | 'recording' | 'paused';

export type ConnectionState = 'open' | 'connecting' | 'close';

export type PrivacyValue = 'all' | 'contacts' | 'contact_blacklist' | 'none';

export type PrivacyOnlineValue = 'all' | 'match_last_seen';

export type PrivacyGroupAddValue = 'all' | 'contacts' | 'contact_blacklist';

export type ReadReceiptsValue = 'all' | 'none';
