import { describe, expect, it } from 'vitest';
import { DELIVERY_SLOTS } from './shop/labels';
import { isValidEmail, latinDigits, validateCheckoutInput, validateLogin, validateOrder, validateReview, validateSignup } from './validators';

describe('validateSignup', () => {
  const ok = { name: '  سعود   العتيبي ', email: '  Soud@Example.COM ', password: 'password1' };

  it('accepts a valid sign-up and normalises name + email', () => {
    expect(validateSignup(ok)).toEqual({ ok: true, data: { name: 'سعود العتيبي', email: 'soud@example.com', password: 'password1' } });
  });
  it('requires every field (also for a non-object body)', () => {
    expect(validateSignup({})).toEqual({ ok: false, errors: { name: 'required', email: 'required', password: 'required' } });
    expect(validateSignup(null)).toMatchObject({ ok: false });
    expect(validateSignup('x')).toMatchObject({ ok: false });
    expect(validateSignup([1, 2])).toMatchObject({ ok: false });
    expect(validateSignup({ ...ok, name: '   ' })).toEqual({ ok: false, errors: { name: 'required' } });
  });
  it('limits the name to 80 characters', () => {
    expect(validateSignup({ ...ok, name: 'ا'.repeat(80) }).ok).toBe(true);
    expect(validateSignup({ ...ok, name: 'ا'.repeat(81) })).toEqual({ ok: false, errors: { name: 'tooLong' } });
  });
  it('checks the email format', () => {
    for (const email of ['soud', 'soud@', '@x.com', 'a@b', 'a b@x.com', 'a@@x.com', 'a@x..com', 'a@.x.com', 'a@x.com.', 'a@-x.com']) {
      expect(validateSignup({ ...ok, email }), email).toEqual({ ok: false, errors: { email: 'invalid' } });
    }
    expect(validateSignup({ ...ok, email: `${'a'.repeat(250)}@x.com` })).toEqual({ ok: false, errors: { email: 'invalid' } });
    expect(isValidEmail('s.o+u_d@mail.example.co')).toBe(true);
  });
  it('needs at least 8 characters and at most 72 bytes of password', () => {
    expect(validateSignup({ ...ok, password: '1234567' })).toEqual({ ok: false, errors: { password: 'tooShort' } });
    expect(validateSignup({ ...ok, password: '12345678' }).ok).toBe(true);
    expect(validateSignup({ ...ok, password: 'a'.repeat(72) }).ok).toBe(true);
    expect(validateSignup({ ...ok, password: 'a'.repeat(73) })).toEqual({ ok: false, errors: { password: 'tooLong' } });
    // Arabic letters are 2 bytes in UTF-8: 36 → 72 bytes ok, 37 → 74 bytes too long.
    expect(validateSignup({ ...ok, password: 'ك'.repeat(36) }).ok).toBe(true);
    expect(validateSignup({ ...ok, password: 'ك'.repeat(37) })).toEqual({ ok: false, errors: { password: 'tooLong' } });
  });
  it('ignores non-string values', () => {
    expect(validateSignup({ name: 5, email: ['a@b.co'], password: { x: 1 } })).toEqual({
      ok: false,
      errors: { name: 'required', email: 'required', password: 'required' },
    });
  });
});

describe('validateLogin', () => {
  it('requires email and password', () => {
    expect(validateLogin({})).toEqual({ ok: false, errors: { email: 'required', password: 'required' } });
    expect(validateLogin({ email: 'a@x.com' })).toEqual({ ok: false, errors: { password: 'required' } });
    expect(validateLogin({ email: 'nope', password: 'x' })).toEqual({ ok: false, errors: { email: 'invalid' } });
  });
  it('normalises the email and keeps the password as typed (no min length at login)', () => {
    expect(validateLogin({ email: ' A@X.com ', password: ' pw ' })).toEqual({ ok: true, data: { email: 'a@x.com', password: ' pw ' } });
  });
});

describe('validateOrder', () => {
  const delivery = { name: 'سعود العتيبي', phone: '9999 8888', area: 'السالمية', address: 'قطعة 1، شارع 2، بيت 3', slot: DELIVERY_SLOTS[1] };
  const body = (over: Record<string, unknown> = {}) => ({
    lines: [
      { t: 'p', id: 'awal', vi: 1, q: 2 },
      { t: 'b', ids: ['fajr', 'bar', 'jumaa'], note: '  مبروك  النجاح ', q: 1 },
    ],
    promo: ' wasmi10 ',
    delivery,
    payment: 'link',
    ...over,
  });

  it('accepts a valid order and normalises it', () => {
    const r = validateOrder(body());
    expect(r).toEqual({
      ok: true,
      data: {
        lines: [
          { t: 'p', id: 'awal', vi: 1, q: 2 },
          { t: 'b', ids: ['fajr', 'bar', 'jumaa'], note: 'مبروك النجاح', q: 1 },
        ],
        promo: 'wasmi10',
        delivery: { ...delivery, phone: '99998888' },
        payment: 'link',
      },
    });
  });

  it('drops any price / total / user field from the body', () => {
    const r = validateOrder(
      body({
        total: 0.001,
        subtotal: 0,
        user: '64b7f0c2a1b2c3d4e5f60718',
        userId: 'x',
        lines: [{ t: 'p', id: 'awal', vi: 1, q: 1, price: 0.001, lineTotal: 0 }],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.data).sort()).toEqual(['delivery', 'lines', 'payment', 'promo']);
    expect(r.data.lines[0]).toEqual({ t: 'p', id: 'awal', vi: 1, q: 1 });
  });

  it('needs 1..30 lines', () => {
    expect(validateOrder(body({ lines: [] }))).toMatchObject({ ok: false, errors: { lines: 'required' } });
    expect(validateOrder(body({ lines: 'awal' }))).toMatchObject({ ok: false, errors: { lines: 'required' } });
    const many = Array.from({ length: 31 }, () => ({ t: 'p', id: 'awal', vi: 1, q: 1 }));
    expect(validateOrder(body({ lines: many }))).toMatchObject({ ok: false, errors: { lines: 'tooLong' } });
    expect(validateOrder(body({ lines: many.slice(0, 30) })).ok).toBe(true);
  });

  it('rejects malformed product lines', () => {
    const bad = [
      { t: 'p', id: 'AWAL', vi: 1, q: 1 },
      { t: 'p', id: 'a', vi: 1, q: 1 },
      { t: 'p', id: '../etc', vi: 1, q: 1 },
      { t: 'p', id: { $ne: null }, vi: 1, q: 1 },
      { t: 'p', id: 'awal', vi: 1.5, q: 1 },
      { t: 'p', id: 'awal', vi: '1', q: 1 },
      { t: 'p', id: 'awal', vi: 1, q: 0 },
      { t: 'p', id: 'awal', vi: 1, q: 100 },
      { t: 'p', id: 'awal', vi: 1, q: 2.5 },
      { t: 'p', id: 'awal', vi: 1, q: '2' },
      { t: 'x', id: 'awal', vi: 1, q: 1 },
      null,
      'awal',
    ];
    for (const line of bad) expect(validateOrder(body({ lines: [line] })), JSON.stringify(line)).toMatchObject({ ok: false, errors: { lines: 'invalid' } });
    // Size index range is checked against the product in the DB later, not here.
    expect(validateOrder(body({ lines: [{ t: 'p', id: 'awal', vi: 9, q: 99 }] })).ok).toBe(true);
  });

  it('a box needs exactly 3 distinct valid slugs, a note ≤ 80 and a quantity', () => {
    const box = (over: Record<string, unknown>) => body({ lines: [{ t: 'b', ids: ['awal', 'fajr', 'bar'], note: '', q: 1, ...over }] });
    expect(validateOrder(box({})).ok).toBe(true);
    expect(validateOrder(box({ note: undefined })).ok).toBe(true);
    expect(validateOrder(box({ ids: ['awal', 'fajr'] }))).toMatchObject({ ok: false, errors: { lines: 'invalid' } });
    expect(validateOrder(box({ ids: ['awal', 'fajr', 'bar', 'dala'] }))).toMatchObject({ ok: false, errors: { lines: 'invalid' } });
    expect(validateOrder(box({ ids: ['awal', 'awal', 'bar'] }))).toMatchObject({ ok: false, errors: { lines: 'invalid' } });
    expect(validateOrder(box({ ids: ['awal', 'fajr', 'BAR'] }))).toMatchObject({ ok: false, errors: { lines: 'invalid' } });
    expect(validateOrder(box({ note: 'ن'.repeat(80) })).ok).toBe(true);
    expect(validateOrder(box({ note: 'ن'.repeat(81) }))).toMatchObject({ ok: false, errors: { lines: 'invalid' } });
    expect(validateOrder(box({ note: 5 }))).toMatchObject({ ok: false, errors: { lines: 'invalid' } });
    expect(validateOrder(box({ q: 0 }))).toMatchObject({ ok: false, errors: { lines: 'invalid' } });
  });

  it('validates the delivery details', () => {
    const d = (over: Record<string, unknown>) => validateOrder(body({ delivery: { ...delivery, ...over } }));
    expect(d({ name: '' })).toMatchObject({ ok: false, errors: { name: 'required' } });
    expect(d({ name: ' سع ' })).toMatchObject({ ok: false, errors: { name: 'tooShort' } });
    expect(d({ name: 'س'.repeat(81) })).toMatchObject({ ok: false, errors: { name: 'tooLong' } });
    expect(d({ phone: '' })).toMatchObject({ ok: false, errors: { phone: 'required' } });
    expect(d({ phone: '1234567' })).toMatchObject({ ok: false, errors: { phone: 'invalid' } });
    expect(d({ phone: '1234567890123' })).toMatchObject({ ok: false, errors: { phone: 'invalid' } });
    expect(d({ phone: '9999-8888' })).toMatchObject({ ok: false, errors: { phone: 'invalid' } });
    expect(d({ phone: '+965 9999 8888' })).toMatchObject({ ok: true, data: { delivery: { phone: '+96599998888' } } });
    expect(d({ phone: '٩٩٩٩ ٨٨٨٨' })).toMatchObject({ ok: true, data: { delivery: { phone: '99998888' } } });
    expect(d({ area: ' ' })).toMatchObject({ ok: false, errors: { area: 'required' } });
    expect(d({ area: 'ا'.repeat(61) })).toMatchObject({ ok: false, errors: { area: 'tooLong' } });
    expect(d({ address: '' })).toMatchObject({ ok: false, errors: { address: 'required' } });
    expect(d({ address: ' 1234 ' })).toMatchObject({ ok: false, errors: { address: 'tooShort' } });
    expect(d({ address: 'ا'.repeat(301) })).toMatchObject({ ok: false, errors: { address: 'tooLong' } });
    expect(validateOrder(body({ delivery: undefined }))).toMatchObject({
      ok: false,
      errors: { name: 'required', phone: 'required', area: 'required', address: 'required' },
    });
  });

  it('defaults the slot to the first one and the payment to cod', () => {
    expect(validateOrder(body({ delivery: { ...delivery, slot: 'midnight' } }))).toMatchObject({ ok: true, data: { delivery: { slot: DELIVERY_SLOTS[0] } } });
    expect(validateOrder(body({ delivery: { ...delivery, slot: undefined } }))).toMatchObject({ ok: true, data: { delivery: { slot: DELIVERY_SLOTS[0] } } });
    expect(validateOrder(body({ payment: undefined }))).toMatchObject({ ok: true, data: { payment: 'cod' } });
    expect(validateOrder(body({ payment: 'cash' }))).toMatchObject({ ok: false, errors: { payment: 'invalid' } });
  });

  it('limits the promo code to 20 characters', () => {
    expect(validateOrder(body({ promo: 'X'.repeat(20) })).ok).toBe(true);
    expect(validateOrder(body({ promo: 'X'.repeat(21) }))).toMatchObject({ ok: false, errors: { promo: 'tooLong' } });
    expect(validateOrder(body({ promo: 42 }))).toMatchObject({ ok: true, data: { promo: '' } });
  });
});

describe('validateReview', () => {
  it('accepts rating 1-5 and 10-400 characters of text', () => {
    expect(validateReview({ rating: 5, text: '  ريحة حلوة مرة وتفوح  ' })).toEqual({ ok: true, data: { rating: 5, text: 'ريحة حلوة مرة وتفوح' } });
    expect(validateReview({ rating: 1, text: 'x'.repeat(400) }).ok).toBe(true);
  });
  it('rating must be an integer 1..5', () => {
    for (const rating of [0, 6, 2.5, '5', null, undefined]) {
      expect(validateReview({ rating, text: 'نص طويل بما يكفي' }), String(rating)).toEqual({ ok: false, errors: { rating: 'required' } });
    }
  });
  it('text 10..400 characters', () => {
    expect(validateReview({ rating: 4, text: '123456789' })).toEqual({ ok: false, errors: { text: 'tooShort' } });
    expect(validateReview({ rating: 4, text: '' })).toEqual({ ok: false, errors: { text: 'tooShort' } });
    expect(validateReview({ rating: 4, text: 'x'.repeat(401) })).toEqual({ ok: false, errors: { text: 'tooLong' } });
  });
});

describe('latinDigits', () => {
  it('converts Arabic-Indic and Persian digits', () => {
    expect(latinDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(latinDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    expect(latinDigits('+965 abc')).toBe('+965 abc');
  });
});

describe('validateCheckoutInput (POST /api/checkout)', () => {
  const delivery = { name: 'سارة العلي', phone: '99887766', area: 'السالمية', address: 'قطعة 2، شارع 10' };
  it('keeps only lines, promo and delivery; any price, total, user id or payment field is ignored', () => {
    const r = validateCheckoutInput({
      lines: [{ t: 'p', id: 'awal', vi: 1, q: 2, price: 0.001, unit: 0.001 }],
      promo: 'wasmi10',
      delivery: { ...delivery, slot: 'مساءً (6-9)' },
      total: 0.001,
      subtotal: 0.001,
      user: '0123456789abcdef01234567',
      userId: '0123456789abcdef01234567',
      payment: 'cod',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.data).sort()).toEqual(['delivery', 'lines', 'promo']);
    expect(r.data.lines).toEqual([{ t: 'p', id: 'awal', vi: 1, q: 2 }]);
    expect(JSON.stringify(r.data)).not.toContain('0.001');
    expect(JSON.stringify(r.data)).not.toContain('0123456789abcdef01234567');
  });
  it('rejects an empty cart and missing delivery details like an order', () => {
    const r = validateCheckoutInput({ lines: [], delivery: {} });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toMatchObject({ lines: 'required', name: 'required', phone: 'required', area: 'required', address: 'required' });
    expect(r.errors).not.toHaveProperty('payment');
  });
  it('rejects overlong delivery fields', () => {
    const r = validateCheckoutInput({ lines: [{ t: 'p', id: 'awal', vi: 1, q: 1 }], delivery: { ...delivery, address: 'x'.repeat(301), area: 'y'.repeat(61) } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toMatchObject({ address: 'tooLong', area: 'tooLong' });
  });
});
