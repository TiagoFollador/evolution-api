/**
 * Fronteira de segurança do webhook Meta.
 *
 * Testa a função pura, não a rota: `supertest` não está nas dependências e a
 * lógica que importa — o que conta como assinatura válida — está toda aqui.
 * Cada caso abaixo é um caminho que precisa recusar, porque o handler de
 * `/webhook/meta` responde 200 incondicionalmente: se o guard deixar passar,
 * nada mais barra.
 */
import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';

import { isValidMetaSignature, secretEquals } from '@api/guards/meta-signature.guard';

const SECRET = 'app-secret-de-teste';
const BODY = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account', entry: [] }));

function sign(body: Buffer, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

describe('isValidMetaSignature', () => {
  it('accepts a signature produced with the configured app secret', () => {
    expect(isValidMetaSignature(BODY, sign(BODY, SECRET), SECRET)).toBe(true);
  });

  it('rejects a body tampered with after signing', () => {
    const header = sign(BODY, SECRET);
    const tampered = Buffer.from(BODY.toString().replace('entry', 'entrY'));

    expect(isValidMetaSignature(tampered, header, SECRET)).toBe(false);
  });

  it('rejects a signature produced with a different secret', () => {
    expect(isValidMetaSignature(BODY, sign(BODY, 'outro-segredo'), SECRET)).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(isValidMetaSignature(BODY, undefined, SECRET)).toBe(false);
  });

  it('rejects a header without the sha256= prefix', () => {
    expect(isValidMetaSignature(BODY, createHmac('sha256', SECRET).update(BODY).digest('hex'), SECRET)).toBe(false);
  });

  it('rejects a truncated signature without throwing', () => {
    const header = sign(BODY, SECRET).slice(0, 20);

    expect(() => isValidMetaSignature(BODY, header, SECRET)).not.toThrow();
    expect(isValidMetaSignature(BODY, header, SECRET)).toBe(false);
  });

  it('rejects non-hex garbage without throwing', () => {
    expect(() => isValidMetaSignature(BODY, 'sha256=nao-e-hex', SECRET)).not.toThrow();
    expect(isValidMetaSignature(BODY, 'sha256=nao-e-hex', SECRET)).toBe(false);
  });

  // Fail-closed: sem segredo configurado não existe assinatura aceitável.
  it('rejects everything when the app secret is empty', () => {
    expect(isValidMetaSignature(BODY, sign(BODY, ''), '')).toBe(false);
  });

  it('rejects when the raw body was never captured', () => {
    expect(isValidMetaSignature(undefined, sign(BODY, SECRET), SECRET)).toBe(false);
  });
});

describe('secretEquals', () => {
  it('accepts an exact match', () => {
    expect(secretEquals('verify-token', 'verify-token')).toBe(true);
  });

  it('rejects a mismatch of the same length', () => {
    expect(secretEquals('verify-tokeX', 'verify-token')).toBe(false);
  });

  it('rejects a length mismatch without throwing', () => {
    expect(() => secretEquals('verify', 'verify-token')).not.toThrow();
    expect(secretEquals('verify', 'verify-token')).toBe(false);
  });

  it('rejects an unset expected secret', () => {
    expect(secretEquals('', '')).toBe(false);
    expect(secretEquals('qualquer-coisa', '')).toBe(false);
  });

  it('rejects a non-string received value', () => {
    expect(secretEquals(undefined, 'verify-token')).toBe(false);
  });
});
