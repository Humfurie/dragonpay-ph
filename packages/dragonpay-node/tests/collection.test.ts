import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPayment, getTransactionStatus, cancelTransaction, getAvailableProcessors } from '../src/collection';
import type { CollectRequestConfig } from '../src/collection';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const config: CollectRequestConfig = {
  merchantId: 'MERCHANT1',
  password: 'secret123',
  baseUrl: 'https://gw.dragonpay.ph/api/collect/v2',
  timeoutMs: 30000,
  maxRetries: 0, // no retries in unit tests to keep them fast
};

describe('createPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends POST to {baseUrl}/{txnid}/post with PascalCase body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ RefNo: 'REF123', Status: 'S', Message: 'OK', Url: 'https://pay.dragonpay.ph/xyz' }),
    });

    const result = await createPayment(
      'TXN-001',
      {
        amount: 100,
        description: 'Test payment',
        email: 'test@example.com',
        procId: 'GCSH',
      },
      config,
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://gw.dragonpay.ph/api/collect/v2/TXN-001/post');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.Amount).toBe('100.00');
    expect(body.Description).toBe('Test payment');
    expect(body.Email).toBe('test@example.com');
    expect(body.ProcId).toBe('GCSH');
    expect(body.Currency).toBe('PHP');

    expect(result.txnId).toBe('TXN-001');
    expect(result.refNo).toBe('REF123');
    expect(result.url).toBe('https://pay.dragonpay.ph/xyz');
  });

  it('includes billing details with PascalCase keys', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ RefNo: 'REF456', Status: 'S', Message: 'OK', Url: 'https://pay.dragonpay.ph/abc' }),
    });

    await createPayment(
      'TXN-002',
      {
        amount: 250.50,
        description: 'With billing',
        email: 'test@example.com',
        billingDetails: {
          firstName: 'Juan',
          lastName: 'Cruz',
          state: 'Metro Manila',
        },
      },
      config,
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.BillingDetails.FirstName).toBe('Juan');
    expect(body.BillingDetails.LastName).toBe('Cruz');
    expect(body.BillingDetails.State).toBe('Metro Manila');
  });

  it('throws DragonPayError on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ Status: -1, Message: 'Unauthorized' }),
    });

    await expect(
      createPayment('TXN-003', { amount: 100, description: 'Fail', email: 'x@y.com' }, config),
    ).rejects.toThrow('Unauthorized');
  });
});

describe('getTransactionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends GET to {baseUrl}/{txnid}', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ RefNo: 'REF100', Status: 'S', Message: 'Completed' }),
    });

    const result = await getTransactionStatus('TXN-100', config);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://gw.dragonpay.ph/api/collect/v2/TXN-100');
    expect(options.method).toBe('GET');
    expect(result.status).toBe('S');
  });
});

describe('cancelTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends GET to {baseUrl}/{txnid}/void', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ Status: 0, Message: 'Voided' }),
    });

    const result = await cancelTransaction('TXN-100', config);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://gw.dragonpay.ph/api/collect/v2/TXN-100/void');
    expect(options.method).toBe('GET');
    expect(result.message).toBe('Voided');
  });
});

describe('getAvailableProcessors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends GET to {baseUrl}/processors with amount filter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([
        { ProcId: 'GCSH', ShortName: 'GCash', LongName: 'GCash', Logo: '', Currencies: ['PHP'], MinAmount: 1, MaxAmount: 50000 },
      ]),
    });

    const result = await getAvailableProcessors(100, config);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://gw.dragonpay.ph/api/collect/v2/processors/100.00');
    expect(result).toHaveLength(1);
    expect(result[0].procId).toBe('GCSH');
  });
});
