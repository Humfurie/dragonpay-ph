import { describe, it, expect } from 'vitest';
import { generateTxnId, formatAmount } from '../src/utils';

describe('generateTxnId', () => {
  it('starts with TXN- prefix', () => {
    expect(generateTxnId()).toMatch(/^TXN-/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateTxnId()));
    expect(ids.size).toBe(100);
  });

  it('contains only alphanumeric characters and hyphens', () => {
    const id = generateTxnId();
    expect(id).toMatch(/^[A-Z0-9-]+$/);
  });
});

describe('formatAmount', () => {
  it('formats integer to 2 decimal places', () => {
    expect(formatAmount(100)).toBe('100.00');
  });

  it('formats float to 2 decimal places', () => {
    expect(formatAmount(99.9)).toBe('99.90');
  });

  it('rounds to 2 decimal places', () => {
    expect(formatAmount(10.999)).toBe('11.00');
  });
});
