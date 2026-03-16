import { describe, it, expect } from 'vitest';
import { validateTxnId, validatePaymentInput, validatePayoutInput } from '../src/validate';

describe('validateTxnId', () => {
  it('accepts valid txnId', () => {
    expect(() => validateTxnId('ORDER-001')).not.toThrow();
  });

  it('rejects empty txnId', () => {
    expect(() => validateTxnId('')).toThrow('txnId is required');
  });

  it('rejects whitespace-only txnId', () => {
    expect(() => validateTxnId('   ')).toThrow('txnId is required');
  });

  it('rejects txnId longer than 40 characters', () => {
    const long = 'A'.repeat(41);
    expect(() => validateTxnId(long)).toThrow('40 characters or less');
  });

  it('accepts txnId exactly 40 characters', () => {
    const exact = 'A'.repeat(40);
    expect(() => validateTxnId(exact)).not.toThrow();
  });
});

describe('validatePaymentInput', () => {
  const valid = { amount: 100, description: 'Test', email: 'test@example.com' };

  it('accepts valid input', () => {
    expect(() => validatePaymentInput(valid)).not.toThrow();
  });

  it('rejects zero amount', () => {
    expect(() => validatePaymentInput({ ...valid, amount: 0 })).toThrow('greater than 0');
  });

  it('rejects negative amount', () => {
    expect(() => validatePaymentInput({ ...valid, amount: -50 })).toThrow('greater than 0');
  });

  it('rejects empty description', () => {
    expect(() => validatePaymentInput({ ...valid, description: '' })).toThrow('description is required');
  });

  it('rejects invalid email', () => {
    expect(() => validatePaymentInput({ ...valid, email: 'notanemail' })).toThrow('valid email');
  });

  it('rejects empty email', () => {
    expect(() => validatePaymentInput({ ...valid, email: '' })).toThrow('valid email');
  });
});

describe('validatePayoutInput', () => {
  const valid = {
    firstName: 'Juan', lastName: 'Cruz', amount: 500,
    description: 'Test', email: 'juan@example.com',
    procId: 'BOG', procDetail: '1234567890',
  };

  it('accepts valid input', () => {
    expect(() => validatePayoutInput(valid)).not.toThrow();
  });

  it('rejects zero amount', () => {
    expect(() => validatePayoutInput({ ...valid, amount: 0 })).toThrow('greater than 0');
  });

  it('rejects empty firstName', () => {
    expect(() => validatePayoutInput({ ...valid, firstName: '' })).toThrow('firstName is required');
  });

  it('rejects empty lastName', () => {
    expect(() => validatePayoutInput({ ...valid, lastName: '' })).toThrow('lastName is required');
  });

  it('rejects invalid email', () => {
    expect(() => validatePayoutInput({ ...valid, email: 'bad' })).toThrow('valid email');
  });

  it('rejects empty procId', () => {
    expect(() => validatePayoutInput({ ...valid, procId: '' })).toThrow('procId is required');
  });

  it('rejects empty procDetail', () => {
    expect(() => validatePayoutInput({ ...valid, procDetail: '' })).toThrow('procDetail');
  });
});
