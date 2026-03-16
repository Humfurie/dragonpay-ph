import { describe, it, expect } from 'vitest';
import { mapProcessorCode, PROCESSOR_MAP } from '../src/processors';

describe('mapProcessorCode', () => {
  it('maps gcash to GCSH', () => {
    expect(mapProcessorCode('gcash')).toBe('GCSH');
  });

  it('maps maya to PYMY', () => {
    expect(mapProcessorCode('maya')).toBe('PYMY');
  });

  it('maps paymaya to PYMY (alias)', () => {
    expect(mapProcessorCode('paymaya')).toBe('PYMY');
  });

  it('maps 7eleven to 7ELE', () => {
    expect(mapProcessorCode('7eleven')).toBe('7ELE');
  });

  it('is case-insensitive', () => {
    expect(mapProcessorCode('GCash')).toBe('GCSH');
    expect(mapProcessorCode('BPI')).toBe('BPI');
  });

  it('returns undefined for unknown processor', () => {
    expect(mapProcessorCode('venmo')).toBeUndefined();
  });

  it('passes through valid ProcId codes unchanged', () => {
    expect(mapProcessorCode('GCSH')).toBe('GCSH');
  });
});

describe('PROCESSOR_MAP', () => {
  it('contains all expected processors', () => {
    expect(Object.keys(PROCESSOR_MAP).length).toBeGreaterThanOrEqual(20);
  });
});
