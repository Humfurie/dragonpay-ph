import { describe, it, expect } from 'vitest';
import { DragonPayError, SignatureVerificationError } from '../src/errors';

describe('DragonPayError', () => {
  it('includes status code and message', () => {
    const err = new DragonPayError('Payment failed', -1, 'Invalid amount');
    expect(err.message).toBe('Payment failed');
    expect(err.code).toBe(-1);
    expect(err.apiMessage).toBe('Invalid amount');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('SignatureVerificationError', () => {
  it('extends DragonPayError', () => {
    const err = new SignatureVerificationError('Bad signature');
    expect(err.message).toBe('Bad signature');
    expect(err).toBeInstanceOf(DragonPayError);
  });
});
