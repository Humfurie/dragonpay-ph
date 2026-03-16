import * as crypto from 'crypto';
import type { PostbackParams, PayoutPostbackParams, DragonPayPublicKey } from './types';
import { getCollectHeaders } from './auth';
import { safeRequest } from './request';

export function verifySha1Digest(
  callback: Pick<PostbackParams, 'txnid' | 'refno' | 'status' | 'message' | 'digest'>,
  password: string,
): boolean {
  if (!callback.digest) return false;
  const message = `${callback.txnid}:${callback.refno}:${callback.status}:${callback.message}:${password}`;
  const expected = crypto.createHash('sha1').update(message).digest('hex').toLowerCase();
  return expected === callback.digest.toLowerCase();
}

export function verifyPayoutDigest(
  callback: Pick<PayoutPostbackParams, 'merchantTxnId' | 'refNo' | 'status' | 'message' | 'digest'>,
  collectionPassword: string,
): boolean {
  if (!callback.digest) return false;
  const message = `${callback.merchantTxnId}:${callback.refNo}:${callback.status}:${callback.message}:${collectionPassword}`;
  const expected = crypto.createHash('sha1').update(message).digest('hex').toLowerCase();
  return expected === callback.digest.toLowerCase();
}

export function verifyHmacSha256(
  callback: Pick<PostbackParams, 'txnid' | 'refno' | 'status' | 'message' | 'merchantid' | 'param1' | 'param2' | 'signature'>,
  password: string,
): boolean {
  if (!callback.signature) return false;
  const message = [
    callback.txnid, callback.refno, callback.status, callback.message,
    callback.merchantid || '', callback.param1 || '', callback.param2 || '',
  ].join(':');
  const expected = crypto.createHmac('sha256', password).update(message).digest('base64');
  return expected === callback.signature;
}

export function buildSignatureMessage(callback: {
  txnid: string;
  refno: string;
  status: string;
  message: string;
  merchantid?: string;
  param1?: string;
  param2?: string;
  amount?: string;
}): string {
  const amountFormatted = parseFloat(callback.amount || '0').toFixed(2);
  return [
    callback.txnid, callback.refno, callback.status, callback.message,
    callback.merchantid || '', callback.param1 || '', callback.param2 || '',
    amountFormatted,
  ].join(':');
}

export function derToPublicKeyPem(base64Der: string): string {
  const derBuffer = Buffer.from(base64Der, 'base64');
  const pemBody = derBuffer.toString('base64').match(/.{1,64}/g)!.join('\n');
  return `-----BEGIN PUBLIC KEY-----\n${pemBody}\n-----END PUBLIC KEY-----`;
}

export function verifyRsaSha256(
  callback: Pick<PostbackParams, 'txnid' | 'refno' | 'status' | 'message' | 'merchantid' | 'param1' | 'param2' | 'amount' | 'signatures'>,
  keys: DragonPayPublicKey[],
): boolean {
  if (!callback.signatures) return false;

  const message = buildSignatureMessage(callback);
  const signatureBuffer = Buffer.from(callback.signatures, 'base64');
  const messageBytes = Buffer.from(message, 'utf-8');

  return keys
    .filter((k) => k.status === 'Active')
    .some((key) => {
      try {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(messageBytes);
        return verifier.verify(derToPublicKeyPem(key.value), signatureBuffer);
      } catch {
        return false;
      }
    });
}

export async function fetchPublicKeys(
  collectBaseUrl: string,
  merchantId: string,
  password: string,
  timeoutMs = 30000,
  maxRetries = 2,
): Promise<DragonPayPublicKey[]> {
  const keysBaseUrl = collectBaseUrl.replace(/\/v2$/, '/v1');
  const { data, status } = await safeRequest<DragonPayPublicKey[]>({
    url: `${keysBaseUrl}/keys/callback`,
    method: 'GET',
    headers: getCollectHeaders(merchantId, password),
    timeoutMs,
    maxRetries,
  });

  if (status >= 400) {
    throw new Error(`Failed to fetch public keys: HTTP ${status}`);
  }

  return data;
}
