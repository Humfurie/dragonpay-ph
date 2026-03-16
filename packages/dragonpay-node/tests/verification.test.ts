import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import {
  verifySha1Digest,
  verifyPayoutDigest,
  verifyHmacSha256,
  buildSignatureMessage,
  verifyRsaSha256,
  derToPublicKeyPem,
  fetchPublicKeys,
} from '../src/verification';
import type { DragonPayPublicKey } from '../src/types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('verifySha1Digest', () => {
  it('verifies valid SHA1 digest for collection postback', () => {
    const message = 'TXN-001:REF123:S:Success:secret123';
    const digest = crypto.createHash('sha1').update(message).digest('hex');

    const result = verifySha1Digest(
      { txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'Success', digest },
      'secret123',
    );
    expect(result).toBe(true);
  });

  it('returns false for invalid digest', () => {
    const result = verifySha1Digest(
      { txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'Success', digest: 'wrong' },
      'secret123',
    );
    expect(result).toBe(false);
  });

  it('returns false if digest is missing', () => {
    const result = verifySha1Digest(
      { txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'Success' },
      'secret123',
    );
    expect(result).toBe(false);
  });
});

describe('verifyPayoutDigest', () => {
  it('verifies valid payout SHA1 digest', () => {
    const message = 'TXN-001:REF123:S:Success:secret123';
    const digest = crypto.createHash('sha1').update(message).digest('hex');

    const result = verifyPayoutDigest(
      { merchantTxnId: 'TXN-001', refNo: 'REF123', status: 'S', message: 'Success', digest },
      'secret123',
    );
    expect(result).toBe(true);
  });

  it('is case-insensitive for hex comparison', () => {
    const message = 'TXN-001:REF123:S:Success:secret123';
    const digest = crypto.createHash('sha1').update(message).digest('hex').toUpperCase();

    const result = verifyPayoutDigest(
      { merchantTxnId: 'TXN-001', refNo: 'REF123', status: 'S', message: 'Success', digest },
      'secret123',
    );
    expect(result).toBe(true);
  });
});

describe('verifyHmacSha256', () => {
  it('verifies valid HMAC-SHA256 signature', () => {
    const message = 'TXN-001:REF123:S:Success:MERCHANT1::';
    const hmac = crypto.createHmac('sha256', 'secret123').update(message).digest('base64');

    const result = verifyHmacSha256(
      {
        txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'Success',
        merchantid: 'MERCHANT1', param1: '', param2: '', signature: hmac,
      },
      'secret123',
    );
    expect(result).toBe(true);
  });

  it('returns false for invalid signature', () => {
    const result = verifyHmacSha256(
      {
        txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'Success',
        merchantid: 'MERCHANT1', param1: '', param2: '', signature: 'wrong',
      },
      'secret123',
    );
    expect(result).toBe(false);
  });

  it('returns false if signature is missing', () => {
    const result = verifyHmacSha256(
      { txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'Success' },
      'secret123',
    );
    expect(result).toBe(false);
  });
});

describe('buildSignatureMessage', () => {
  it('joins 8 fields with colons', () => {
    const msg = buildSignatureMessage({
      txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'OK',
      merchantid: 'MERCHANT1', param1: 'p1', param2: 'p2', amount: '100',
    });
    expect(msg).toBe('TXN-001:REF123:S:OK:MERCHANT1:p1:p2:100.00');
  });

  it('formats amount to 2 decimal places', () => {
    const msg = buildSignatureMessage({
      txnid: 'T', refno: 'R', status: 'S', message: 'M',
      amount: '99.9',
    });
    expect(msg).toBe('T:R:S:M::::99.90');
  });

  it('defaults missing fields to empty strings', () => {
    const msg = buildSignatureMessage({ txnid: 'T', refno: 'R', status: 'S', message: 'M' });
    expect(msg).toBe('T:R:S:M::::0.00');
  });
});

describe('derToPublicKeyPem', () => {
  it('wraps base64 DER in PEM headers with 64-char lines', () => {
    const shortDer = Buffer.from('test-key-data').toString('base64');
    const pem = derToPublicKeyPem(shortDer);
    expect(pem).toMatch(/^-----BEGIN PUBLIC KEY-----\n/);
    expect(pem).toMatch(/\n-----END PUBLIC KEY-----$/);
  });
});

describe('verifyRsaSha256', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const publicKeyBase64 = (publicKey as Buffer).toString('base64');

  it('verifies a valid RSA-SHA256 signature', () => {
    const message = 'TXN-001:REF123:S:OK:MERCHANT1:::100.00';
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(Buffer.from(message, 'utf-8'));
    const signature = signer.sign(privateKey as string, 'base64');

    const keys: DragonPayPublicKey[] = [{ value: publicKeyBase64, status: 'Active' }];

    const result = verifyRsaSha256(
      {
        txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'OK',
        merchantid: 'MERCHANT1', param1: '', param2: '', amount: '100',
        signatures: signature,
      },
      keys,
    );
    expect(result).toBe(true);
  });

  it('returns false for invalid signature', () => {
    const keys: DragonPayPublicKey[] = [{ value: publicKeyBase64, status: 'Active' }];

    const result = verifyRsaSha256(
      {
        txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'OK',
        merchantid: 'MERCHANT1', amount: '100', signatures: 'invalidsig==',
      },
      keys,
    );
    expect(result).toBe(false);
  });

  it('skips revoked keys', () => {
    const message = 'TXN-001:REF123:S:OK:MERCHANT1::100.00';
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(Buffer.from(message, 'utf-8'));
    const signature = signer.sign(privateKey as string, 'base64');

    const keys: DragonPayPublicKey[] = [{ value: publicKeyBase64, status: 'Revoked' }];

    const result = verifyRsaSha256(
      {
        txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'OK',
        merchantid: 'MERCHANT1', amount: '100', signatures: signature,
      },
      keys,
    );
    expect(result).toBe(false);
  });

  it('returns false if signatures field is missing', () => {
    const keys: DragonPayPublicKey[] = [{ value: publicKeyBase64, status: 'Active' }];
    const result = verifyRsaSha256(
      { txnid: 'T', refno: 'R', status: 'S', message: 'M' },
      keys,
    );
    expect(result).toBe(false);
  });
});

describe('fetchPublicKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches keys from /v1/keys/callback endpoint', async () => {
    const mockKeys = [{ value: 'abc123', status: 'Active' }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockKeys,
    });

    const keys = await fetchPublicKeys('https://gw.dragonpay.ph/api/collect/v2', 'MERCHANT1', 'secret');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://gw.dragonpay.ph/api/collect/v1/keys/callback');
    expect(keys).toEqual(mockKeys);
  });
});
