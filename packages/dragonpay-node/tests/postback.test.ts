import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { DragonPayClient } from '../src/client';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('handlePostback', () => {
  let client: DragonPayClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new DragonPayClient({
      merchantId: 'MERCHANT1',
      password: 'secret123',
    });
  });

  it('accepts a plain object (like Express req.query)', async () => {
    const digest = crypto.createHash('sha1')
      .update('TXN-1:REF-1:S:OK:secret123')
      .digest('hex');

    const result = await client.handlePostback({
      txnid: 'TXN-1',
      refno: 'REF-1',
      status: 'S',
      message: 'OK',
      digest,
    });

    expect(result.txnId).toBe('TXN-1');
    expect(result.status).toBe('S');
    expect(result.verified).toBe(true);
  });

  it('accepts URLSearchParams (like from request body)', async () => {
    const digest = crypto.createHash('sha1')
      .update('TXN-2:REF-2:F:Failed:secret123')
      .digest('hex');

    const params = new URLSearchParams();
    params.set('txnid', 'TXN-2');
    params.set('refno', 'REF-2');
    params.set('status', 'F');
    params.set('message', 'Failed');
    params.set('digest', digest);

    const result = await client.handlePostback(params);

    expect(result.txnId).toBe('TXN-2');
    expect(result.status).toBe('F');
    expect(result.verified).toBe(true);
  });

  it('throws on missing required fields', async () => {
    await expect(
      client.handlePostback({ txnid: 'TXN-1' }),
    ).rejects.toThrow('missing txnid, refno, or status');
  });

  it('returns verified: false for invalid digest', async () => {
    const result = await client.handlePostback({
      txnid: 'TXN-1',
      refno: 'REF-1',
      status: 'S',
      message: 'OK',
      digest: 'wrong',
    });

    expect(result.verified).toBe(false);
  });

  it('skips verification when configured', async () => {
    const skipClient = new DragonPayClient({
      merchantId: 'MERCHANT1',
      password: 'secret123',
      skipVerification: true,
    });

    const result = await skipClient.handlePostback({
      txnid: 'TXN-1',
      refno: 'REF-1',
      status: 'S',
      message: 'OK',
    });

    expect(result.verified).toBe(true);
  });

  it('includes optional fields (amount, procid, etc)', async () => {
    const skipClient = new DragonPayClient({
      merchantId: 'MERCHANT1',
      password: 'secret123',
      skipVerification: true,
    });

    const result = await skipClient.handlePostback({
      txnid: 'TXN-1',
      refno: 'REF-1',
      status: 'S',
      message: 'OK',
      amount: '1500.00',
      ccy: 'PHP',
      procid: 'GCSH',
    });

    expect(result.amount).toBe(1500);
    expect(result.currency).toBe('PHP');
    expect(result.procId).toBe('GCSH');
  });
});

describe('handlePayoutPostback', () => {
  it('verifies payout postback with SHA1 digest', () => {
    const client = new DragonPayClient({
      merchantId: 'MERCHANT1',
      password: 'secret123',
    });

    const digest = crypto.createHash('sha1')
      .update('PAYOUT-1:PREF-1:S:Completed:secret123')
      .digest('hex');

    const result = client.handlePayoutPostback({
      merchantTxnId: 'PAYOUT-1',
      refNo: 'PREF-1',
      status: 'S',
      message: 'Completed',
      digest,
    });

    expect(result.txnId).toBe('PAYOUT-1');
    expect(result.verified).toBe(true);
  });

  it('handles case-insensitive param names', () => {
    const client = new DragonPayClient({
      merchantId: 'MERCHANT1',
      password: 'secret123',
      skipVerification: true,
    });

    const result = client.handlePayoutPostback({
      merchanttxnid: 'PAYOUT-1',
      refno: 'PREF-1',
      status: 'S',
      message: 'Done',
    });

    expect(result.txnId).toBe('PAYOUT-1');
  });

  it('throws on missing required fields', () => {
    const client = new DragonPayClient({
      merchantId: 'MERCHANT1',
      password: 'secret123',
    });

    expect(() => client.handlePayoutPostback({ status: 'S' })).toThrow('missing merchantTxnId');
  });
});

describe('parseReturnParams', () => {
  it('parses return URL query params', () => {
    const client = new DragonPayClient({
      merchantId: 'MERCHANT1',
      password: 'secret123',
    });

    const result = client.parseReturnParams({
      txnid: 'TXN-1',
      refno: 'REF-1',
      status: 'S',
      message: 'Payment complete',
    });

    expect(result.txnId).toBe('TXN-1');
    expect(result.status).toBe('S');
  });

  it('works with URLSearchParams', () => {
    const client = new DragonPayClient({
      merchantId: 'MERCHANT1',
      password: 'secret123',
    });

    const params = new URLSearchParams('txnid=TXN-1&refno=REF-1&status=S&message=OK');
    const result = client.parseReturnParams(params);

    expect(result.txnId).toBe('TXN-1');
  });
});
