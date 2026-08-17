/**
 * Prova em runtime a montagem de middleware que main.ts usa para o webhook Meta.
 *
 * O teste unitário cobre a matemática do HMAC; este cobre a parte que só falha
 * montada: que o parser dedicado em /webhook/meta captura o corpo cru, que o
 * json() global montado depois não atrapalha (o body-parser faz short-circuit
 * quando req.body já existe), e que o handler — que responde 200 a tudo — nunca
 * é alcançado quando a assinatura não confere.
 *
 * Sobe um servidor real em porta efêmera em vez de usar supertest, que não é
 * dependência do projeto.
 */
import { createHmac } from 'crypto';
import express, { json, urlencoded } from 'express';
import { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { metaSignatureGuard, RawBodyRequest } from '@api/guards/meta-signature.guard';

// Precisa bater com test/setup/env.ts — o guard lê a config real.
const SECRET = 'test-app-secret';

const PAYLOAD = {
  object: 'whatsapp_business_account',
  entry: [{ id: '102290129340398', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp' } }] }],
};

let baseUrl: string;
let server: ReturnType<express.Express['listen']>;
/** Corpo que o handler enxergou, para provar que o parse ainda acontece. */
let seenBody: unknown;

beforeAll(async () => {
  const app = express();

  // Mesma ordem de main.ts: parser dedicado primeiro, parsers globais depois.
  app.use(
    '/webhook/meta',
    json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as RawBodyRequest).rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: '136mb' }), json({ limit: '136mb' }));

  app.post('/webhook/meta', metaSignatureGuard, (req, res) => {
    seenBody = req.body;
    return res.status(200).json({ status: 'success' });
  });

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

function post(body: string, signature?: string) {
  return fetch(`${baseUrl}/webhook/meta`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(signature ? { 'x-hub-signature-256': signature } : {}),
    },
    body,
  });
}

function sign(body: string): string {
  return `sha256=${createHmac('sha256', SECRET).update(Buffer.from(body)).digest('hex')}`;
}

describe('POST /webhook/meta middleware chain', () => {
  it('accepts a correctly signed payload and still parses the body', async () => {
    const body = JSON.stringify(PAYLOAD);
    seenBody = undefined;

    const res = await post(body, sign(body));

    expect(res.status).toBe(200);
    // Prova que o parser dedicado fez o parse: o handler recebeu o objeto, não
    // um Buffer, apesar do json() global montado depois.
    expect(seenBody).toEqual(PAYLOAD);
  });

  it('rejects a payload whose body was altered after signing', async () => {
    const body = JSON.stringify(PAYLOAD);
    const signature = sign(body);
    const tampered = JSON.stringify({ ...PAYLOAD, object: 'instagram' });
    seenBody = undefined;

    const res = await post(tampered, signature);

    expect(res.status).toBe(401);
    // O handler responde 200 a tudo, então só o guard barra: se ele passar,
    // nada mais impede um POST forjado.
    expect(seenBody).toBeUndefined();
  });

  it('rejects a payload with no signature header', async () => {
    const res = await post(JSON.stringify(PAYLOAD));

    expect(res.status).toBe(401);
  });

  it('rejects a signature computed with the wrong secret', async () => {
    const body = JSON.stringify(PAYLOAD);
    const wrong = `sha256=${createHmac('sha256', 'segredo-errado').update(Buffer.from(body)).digest('hex')}`;

    expect((await post(body, wrong)).status).toBe(401);
  });

  it('preserves byte-exact whitespace when verifying', async () => {
    // JSON.stringify com indentação: mesmo objeto, bytes diferentes. O HMAC é
    // sobre os bytes, então re-serializar o corpo parseado quebraria a validação.
    const body = JSON.stringify(PAYLOAD, null, 2);

    expect((await post(body, sign(body))).status).toBe(200);
  });
});
