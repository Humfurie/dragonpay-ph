import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DragonPayClient } from '../src/client';
import { createMockServer } from '../src/mock-server';

const PORT = 4099;

describe('Mock server integration', () => {
  const mock = createMockServer({ port: PORT, merchantId: 'TEST', password: 'secret' });
  const baseUrl = `http://localhost:${PORT}/api/collect/v2`;
  const payoutUrl = `http://localhost:${PORT}/api/payout/merchant/v1`;

  const client = new DragonPayClient({
    merchantId: 'TEST',
    password: 'secret',
    collectUrl: baseUrl,
    payoutPassword: 'payout-token',
    payoutUrl,
    skipVerification: true,
  });

  beforeAll(async () => {
    await mock.start();
  });

  afterAll(async () => {
    await mock.stop();
  });

  it('creates a payment and gets a redirect URL', async () => {
    const result = await client.createPayment('INT-001', {
      amount: 1500,
      description: 'Integration test',
      email: 'test@example.com',
      procId: 'GCSH',
    });

    expect(result.txnId).toBe('INT-001');
    expect(result.refNo).toMatch(/^MOCK-REF-/);
    expect(result.url).toContain('/pay/INT-001');
  });

  it('rejects duplicate transaction IDs', async () => {
    await expect(
      client.createPayment('INT-001', {
        amount: 100,
        description: 'Duplicate',
        email: 'dup@example.com',
      }),
    ).rejects.toThrow('Duplicate');
  });

  it('gets transaction status', async () => {
    const status = await client.getTransactionStatus('INT-001');
    expect(status.status).toBe('P');
    expect(status.refNo).toMatch(/^MOCK-REF-/);
  });

  it('cancels a transaction', async () => {
    const result = await client.cancelTransaction('INT-001');
    expect(result.message).toBe('Voided');

    const status = await client.getTransactionStatus('INT-001');
    expect(status.status).toBe('V');
  });

  it('lists available processors', async () => {
    const processors = await client.getAvailableProcessors(1000);
    expect(processors.length).toBeGreaterThan(0);
    expect(processors[0].procId).toBe('GCSH');
  });

  it('creates a payout', async () => {
    const result = await client.createPayout('PAYOUT-INT-001', {
      firstName: 'Juan',
      lastName: 'Cruz',
      amount: 500,
      description: 'Test payout',
      email: 'juan@example.com',
      procId: 'BOG',
      procDetail: '1234567890',
    });

    expect(result.refNo).toMatch(/^MOCK-REF-/);
    expect(result.status).toBe('Q');
  });

  it('gets payout status', async () => {
    const status = await client.getPayoutStatus('PAYOUT-INT-001');
    expect(status.status).toBe('Q');
  });
});
