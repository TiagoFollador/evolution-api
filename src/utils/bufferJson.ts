/**
 * JSON replacer/reviver that round-trips Buffer and Uint8Array through the
 * cache. Replaces `BufferJSON` from `baileys`, whose wire format this matches
 * exactly so existing cache entries keep deserialising.
 */

type SerializedBuffer = { type: 'Buffer'; data: string };

const isSerializedBuffer = (value: any): value is SerializedBuffer =>
  !!value && value.type === 'Buffer' && typeof value.data === 'string';

export const bufferJson = {
  replacer: (_key: string, value: any) => {
    if (Buffer.isBuffer(value) || value instanceof Uint8Array || value?.type === 'Buffer') {
      return { type: 'Buffer', data: Buffer.from(value?.data || value).toString('base64') };
    }

    return value;
  },

  reviver: (_key: string, value: any) => {
    if (isSerializedBuffer(value)) {
      return Buffer.from(value.data, 'base64');
    }

    // Entries written without the replacer land as `{"0":12,"1":34,…}`.
    // Baileys coerced those back to Buffer, and cached values predating this
    // module rely on it, so the coercion is reproduced verbatim.
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const keys = Object.keys(value);
      if (keys.length > 0 && keys.every((k) => !isNaN(parseInt(k, 10)))) {
        const values = Object.values(value);
        if (values.every((v) => typeof v === 'number')) {
          return Buffer.from(values as number[]);
        }
      }
    }

    return value;
  },
};
