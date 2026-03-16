import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DragonPayClient } from '../src/client';
import type { DragonPayPublicKey } from '../src/types';
import * as crypto from 'crypto';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockOk(body: unknown) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

describe('DragonPayClient', () => {
  let client: DragonPayClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new DragonPayClient({
      merchantId: 'MERCHANT1',
      password: 'secret123',
      maxRetries: 0,
    });
  });

  it('initializes with default production URLs', () => {
    expect(client).toBeDefined();
  });

  it('creates a payment', async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ RefNo: 'REF1', Status: 'S', Message: 'OK', Url: 'https://pay.dragonpay.ph/x' }));

    const result = await client.createPayment('TXN-1', {
      amount: 100, description: 'Test', email: 'test@test.com',
    });

    expect(result.txnId).toBe('TXN-1');
    expect(result.refNo).toBe('REF1');
  });

  it('gets transaction status', async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ RefNo: 'REF1', Status: 'S', Message: 'OK' }));

    const result = await client.getTransactionStatus('TXN-1');
    expect(result.status).toBe('S');
  });

  it('cancels a transaction', async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ Status: 0, Message: 'Voided' }));

    const result = await client.cancelTransaction('TXN-1');
    expect(result.message).toBe('Voided');
  });

  it('verifies postback with RSA-SHA256 (signatures field)', async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const message = 'TXN-1:REF1:S:OK:MERCHANT1:::100.00';
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(Buffer.from(message, 'utf-8'));
    const signature = signer.sign(privateKey, 'base64');

    mockFetch.mockResolvedValueOnce(mockOk([{ value: (publicKey as Buffer).toString('base64'), status: 'Active' }]));

    const result = await client.verifyPostback({
      txnid: 'TXN-1', refno: 'REF1', status: 'S', message: 'OK',
      merchantid: 'MERCHANT1', param1: '', param2: '', amount: '100',
      signatures: signature,
    });

    expect(result.verified).toBe(true);
    expect(result.txnId).toBe('TXN-1');
    expect(result.status).toBe('S');
  });

  it('skips verification when skipVerification is true', async () => {
    const skipClient = new DragonPayClient({
      merchantId: 'MERCHANT1',
      password: 'secret123',
      skipVerification: true,
    });

    const result = await skipClient.verifyPostback({
      txnid: 'TXN-1', refno: 'REF1', status: 'S', message: 'OK',
    });

    expect(result.verified).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('generates unique transaction IDs', () => {
    const id1 = client.generateTxnId();
    const id2 = client.generateTxnId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^TXN-/);
  });

  it('maps processor codes', () => {
    expect(client.mapProcessorCode('gcash')).toBe('GCSH');
    expect(client.mapProcessorCode('unknown')).toBeUndefined();
  });
});

describe('DragonPayClient — payout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws if payout is called without payout credentials', async () => {
    const client = new DragonPayClient({
      merchantId: 'MERCHANT1',
      password: 'secret123',
    });

    await expect(
      client.createPayout('PAYOUT-001', {
        firstName: 'Juan', lastName: 'Cruz', amount: 100,
        description: 'Test', email: 'x@y.com', procId: 'BOG', procDetail: '123',
      }),
    ).rejects.toThrow('Payout credentials not configured');
  });

  it('creates a payout when credentials are provided', async () => {
    const client = new DragonPayClient({
      merchantId: 'MERCHANT1',
      password: 'secret123',
      payoutPassword: 'payoutSecret',
      payoutUrl: 'https://gw.dragonpay.ph/api/payout/merchant/v1',
      maxRetries: 0,
    });

    mockFetch.mockResolvedValueOnce(mockOk({ Code: 0, Message: 'PREF-1' }));

    const result = await client.createPayout('PAYOUT-001', {
      firstName: 'Juan', lastName: 'Cruz', amount: 500,
      description: 'Payout', email: 'j@x.com', procId: 'BOG', procDetail: '123',
    });

    expect(result.refNo).toBe('PREF-1');
  });
});
