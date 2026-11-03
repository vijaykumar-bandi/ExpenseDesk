import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, todayInKolkata } from '../dates';

describe('formatDateTime', () => {
  it('shows a UTC timestamp in Asia/Kolkata', () => {
    expect(formatDateTime('2026-11-03T04:46:50Z')).toBe('03 Nov 2026, 10:16');
  });

  it('returns an empty string for a missing value', () => {
    expect(formatDateTime(null)).toBe('');
  });
});

describe('formatDate', () => {
  it('formats a calendar date', () => {
    expect(formatDate('2026-11-03')).toBe('03 Nov 2026');
  });
});

describe('todayInKolkata', () => {
  it('returns a YYYY-MM-DD date', () => {
    expect(todayInKolkata()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
