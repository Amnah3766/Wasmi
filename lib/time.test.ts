import { describe, expect, it } from 'vitest';
import { arabicDate, kuwaitMonth, relativeArabic } from './time';

describe('kuwaitMonth (Asia/Kuwait, UTC+3)', () => {
  it('returns 1-12 in Kuwait time, not UTC', () => {
    expect(kuwaitMonth(new Date('2026-11-08T10:00:00Z'))).toBe(11);
    // 22:30 UTC on 31 Jan is already 01:30 on 1 Feb in Kuwait.
    expect(kuwaitMonth(new Date('2026-01-31T22:30:00Z'))).toBe(2);
    expect(kuwaitMonth(new Date('2026-12-31T21:00:00Z'))).toBe(1);
    expect(kuwaitMonth(new Date('2026-12-31T20:59:00Z'))).toBe(12);
  });
  it('defaults to now', () => {
    const m = kuwaitMonth();
    expect(m).toBeGreaterThanOrEqual(1);
    expect(m).toBeLessThanOrEqual(12);
  });
});

describe('relativeArabic', () => {
  const now = new Date('2026-11-08T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const MIN = 60_000;

  it('says الحين for under a minute (and for clock-skewed future times)', () => {
    expect(relativeArabic(ago(30_000), now)).toBe('الحين');
    expect(relativeArabic(now, now)).toBe('الحين');
    expect(relativeArabic(new Date(now.getTime() + 5 * MIN), now)).toBe('الحين');
  });
  it('minutes, hours, days', () => {
    expect(relativeArabic(ago(MIN), now)).toBe('قبل 1 دقيقة');
    expect(relativeArabic(ago(5 * MIN), now)).toBe('قبل 5 دقيقة');
    expect(relativeArabic(ago(59 * MIN), now)).toBe('قبل 59 دقيقة');
    expect(relativeArabic(ago(60 * MIN), now)).toBe('قبل 1 ساعة');
    expect(relativeArabic(ago(3 * 60 * MIN), now)).toBe('قبل 3 ساعة');
    expect(relativeArabic(ago(2 * 24 * 60 * MIN), now)).toBe('قبل 2 يوم');
    expect(relativeArabic(ago(29 * 24 * 60 * MIN), now)).toBe('قبل 29 يوم');
  });
  it('falls back to a Kuwait date after 30 days', () => {
    expect(relativeArabic(new Date('2026-09-01T09:00:00Z'), now)).toBe('1 سبتمبر 2026');
  });
  it('accepts ISO strings and ms; bad input gives an empty string', () => {
    expect(relativeArabic(ago(10 * MIN).toISOString(), now.getTime())).toBe('قبل 10 دقيقة');
    expect(relativeArabic('not a date', now)).toBe('');
  });
});

describe('arabicDate', () => {
  it('formats in Kuwait time with Arabic month names and Latin digits', () => {
    expect(arabicDate(new Date('2026-11-05T12:00:00Z'))).toBe('5 نوفمبر 2026');
    expect(arabicDate(new Date('2026-12-31T22:00:00Z'))).toBe('1 يناير 2027');
    expect(arabicDate('nope')).toBe('');
  });
});
