import { describe, it, expect } from 'vitest';
import { getCollectHeaders, getPayoutHeaders } from '../src/auth';

describe('getCollectHeaders', () => {
  it('returns Basic auth with base64-encoded merchantId:password', () => {
    const headers = getCollectHeaders('MERCHANT1', 'secret123');
    const expected = Buffer.from('MERCHANT1:secret123', 'utf-8').toString('base64');
    expect(headers.Authorization).toBe(`Basic ${expected}`);
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('getPayoutHeaders', () => {
  it('returns Bearer auth with payout password', () => {
    const headers = getPayoutHeaders('payoutSecret');
    expect(headers.Authorization).toBe('Bearer payoutSecret');
    expect(headers['Content-Type']).toBe('application/json');
  });
});
