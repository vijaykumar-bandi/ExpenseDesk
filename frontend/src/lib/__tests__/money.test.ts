import { describe, expect, it } from 'vitest';
import { formatInr, parseInr } from '../money';

describe('formatInr', () => {
  it('formats paise as rupees with two decimals', () => {
    expect(formatInr(200075)).toBe('₹2,000.75');
    expect(formatInr(0)).toBe('₹0.00');
    expect(formatInr(null)).toBe('₹0.00');
  });
});

describe('parseInr', () => {
  it('parses rupees into paise', () => {
    expect(parseInr('2,000.75')).toBe(200075);
    expect(parseInr('₹750.50')).toBe(75050);
    expect(parseInr('1250')).toBe(125000);
  });

  it('returns NaN for text that is not a number', () => {
    expect(Number.isNaN(parseInr('abc'))).toBe(true);
    expect(Number.isNaN(parseInr(''))).toBe(true);
  });
});
