import { configService, WaBusiness } from '@config/env.config';
import { Logger } from '@config/logger.config';
import { createHmac, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';

const logger = new Logger('META-SIGNATURE');

/**
 * O parser montado em `/webhook/meta` (src/main.ts) anexa o corpo cru aqui.
 * Sem ele não há como recalcular o HMAC, então a ausência é tratada como falha.
 */
export type RawBodyRequest = Request & { rawBody?: Buffer };

const SIGNATURE_HEADER = 'x-hub-signature-256';
const SIGNATURE_PREFIX = 'sha256=';

/**
 * Confere a assinatura `X-Hub-Signature-256` que a Meta envia em todo webhook.
 *
 * Fail-closed em cada caminho de dúvida — app secret não configurado, corpo cru
 * ausente, header faltando ou malformado. Um webhook que aceita payload sem
 * assinatura é um POST não autenticado com outro nome.
 */
export function isValidMetaSignature(
  rawBody: Buffer | undefined,
  header: string | undefined,
  appSecret: string,
): boolean {
  if (!appSecret || !rawBody || !header?.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const received = Buffer.from(header.slice(SIGNATURE_PREFIX.length), 'hex');
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();

  // timingSafeEqual lança quando os comprimentos diferem — e um hex inválido
  // produz um Buffer curto, então a checagem precisa vir antes.
  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

/**
 * Compara dois segredos em tempo constante. Usada no challenge de verificação,
 * onde o valor esperado é o verify token e não um digest de tamanho fixo.
 */
export function secretEquals(received: string | undefined, expected: string): boolean {
  if (!expected || typeof received !== 'string') {
    return false;
  }

  const a = Buffer.from(received);
  const b = Buffer.from(expected);

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

export function metaSignatureGuard(req: RawBodyRequest, res: Response, next: NextFunction) {
  const { APP_SECRET } = configService.get<WaBusiness>('WA_BUSINESS');

  if (!APP_SECRET) {
    logger.error(`Rejected ${req.originalUrl}: WA_BUSINESS_APP_SECRET is not set`);
    return res.status(401).json({ status: 401, error: 'Unauthorized' });
  }

  if (!isValidMetaSignature(req.rawBody, req.get(SIGNATURE_HEADER), APP_SECRET)) {
    // Nunca logar a assinatura esperada — só o fato da rejeição.
    logger.error(`Rejected ${req.originalUrl}: invalid or missing ${SIGNATURE_HEADER}`);
    return res.status(401).json({ status: 401, error: 'Unauthorized' });
  }

  return next();
}
