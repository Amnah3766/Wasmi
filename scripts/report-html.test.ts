import { describe, expect, it } from 'vitest';
import { hashPreview, kuwaitDateTime, maskEmail, renderDbReport } from './report-html';

const FULL_HASH = '$2b$12$abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUVWXYZ01234';

describe('db report helpers', () => {
  it('masks emails', () => {
    expect(maskEmail('soud@gmail.com')).toBe('s***@gmail.com');
    expect(maskEmail('a@x.co')).toBe('a***@x.co');
    expect(maskEmail('broken')).toBe('***');
  });
  it('shows only the hash prefix', () => {
    expect(hashPreview(FULL_HASH)).toBe('$2b$12$…');
    expect(hashPreview('')).toBe('(none)');
  });
  it('formats Kuwait time', () => {
    expect(kuwaitDateTime(new Date('2026-11-08T21:30:00Z'))).toBe('2026-11-09 00:30');
    expect(kuwaitDateTime(null)).toBe('');
  });
});

describe('renderDbReport', () => {
  const html = renderDbReport({
    database: 'wasmi',
    atlas: true,
    generatedAt: new Date('2026-11-08T10:00:00Z'),
    products: [
      { slug: 'awal', name: 'تراب الوسمي', category: 'candle', price: 9.5, seasons: [10, 11], allYear: false },
      { slug: 'jadda', name: 'عود طائفي', category: 'incense', price: 12, seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], allYear: true },
    ],
    users: [{ name: '<script>alert(1)</script>', email: 'soud@gmail.com', passwordHash: FULL_HASH, createdAt: new Date('2026-11-08T10:00:00Z') }],
    orders: [{ orderNo: 'WSM-123456', userName: 'سعود', itemsCount: 3, total: 25.8, status: 'pending', createdAt: new Date('2026-11-08T10:00:00Z') }],
    reviews: { total: 25, samples: 24 },
  });

  it('is an RTL Arabic page with the three collections', () => {
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain('products · 2');
    expect(html).toContain('users · 1');
    expect(html).toContain('orders · 1');
    expect(html).toContain('reviews · 25');
  });
  it('formats prices, categories and seasons', () => {
    expect(html).toContain('9.500 د.ك');
    expect(html).toContain('25.800 د.ك');
    expect(html).toContain('شمعة');
    expect(html).toContain('أكتوبر، نوفمبر');
    expect(html).toContain('طول السنة');
    expect(html).toContain('استلمنا طلبك');
  });
  it('never contains a full hash or a full email, and escapes HTML', () => {
    expect(html).not.toContain(FULL_HASH);
    expect(html).toContain('$2b$12$…');
    expect(html).not.toContain('soud@gmail.com');
    expect(html).toContain('s***@gmail.com');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toMatch(/mongodb(\+srv)?:\/\//);
  });
});
