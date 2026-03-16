import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPayout, getPayoutStatus } from '../src/payout';
import type { PayoutRequestConfig } from '../src/payout';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const config: PayoutRequestConfig = {
  merchantId: 'MERCHANT1',
  payoutPassword: 'payoutSecret',
  payoutUrl: 'https://gw.dragonpay.ph/api/payout/merchant/v1',
  timeoutMs: 30000,
  maxRetries: 0,
};

describe('createPayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends POST to {payoutUrl}/{merchantId}/post with Bearer auth', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ Code: 0, Message: 'PAYOUT-REF-001' }),
    });

    const result = await createPayout(
      'TXN-P-001',
      {
        firstName: 'Juan',
        lastName: 'Cruz',
        amount: 500,
        description: 'Payout test',
        email: 'juan@example.com',
        procId: 'BOG',
        procDetail: '1234567890',
      },
      config,
    );

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://gw.dragonpay.ph/api/payout/merchant/v1/MERCHANT1/post');
    expect(options.headers.Authorization).toBe('Bearer payoutSecret');

    const body = JSON.parse(options.body);
    expect(body.TxnId).toBe('TXN-P-001');
    expect(body.FirstName).toBe('Juan');
    expect(body.Amount).toBe('500.00');
    expect(body.ProcId).toBe('BOG');
    expect(body.ProcDetail).toBe('1234567890');

    expect(result.refNo).toBe('PAYOUT-REF-001');
    expect(result.status).toBe('Q');
  });

  it('throws on non-zero Code', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ Code: -1, Message: 'Invalid account' }),
    });

    await expect(
      createPayout(
        'TXN-P-002',
        { firstName: 'A', lastName: 'B', amount: 100, description: 'Fail', email: 'x@y.com', procId: 'BOG', procDetail: '999' },
        config,
      ),
    ).rejects.toThrow('Invalid account');
  });
});

describe('getPayoutStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends GET to {payoutUrl}/{merchantId}/{txnId}', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ RefNo: 'PREF-1', Status: 'S', Message: 'Completed' }),
    });

    const result = await getPayoutStatus('TXN-P-001', config);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://gw.dragonpay.ph/api/payout/merchant/v1/MERCHANT1/TXN-P-001');
    expect(result.status).toBe('S');
  });
});
