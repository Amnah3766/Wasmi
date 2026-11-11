import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { Order } from '../models/Order';
import { User } from '../models/User';
import { newOrderNo } from './orders';

const oid = () => new mongoose.Types.ObjectId();
const item = (over: Record<string, unknown> = {}) => ({
  kind: 'product',
  product: oid(),
  slug: 'awal',
  name: 'تراب الوسمي',
  quantity: 1,
  price: 9.5,
  lineTotal: 9.5,
  ...over,
});
const order = (over: Record<string, unknown> = {}) => ({
  user: oid(),
  orderNo: 'WSM-123456',
  items: [item()],
  subtotal: 9.5,
  discount: 0,
  shipping: 1.5,
  total: 11,
  promoCode: null,
  delivery: { name: 'سعود', phone: '99998888', area: 'حولي', address: 'قطعة 1 شارع 2', slot: 'صباحًا (9-12)' },
  paymentMethod: 'cod',
  ...over,
});

describe('Order model', () => {
  it('accepts a valid order and defaults the status to pending', async () => {
    const doc = new Order(order());
    await expect(doc.validate()).resolves.toBeUndefined();
    expect(doc.status).toBe('pending');
  });
  it('requires the owner, a WSM-###### number and at least one item', async () => {
    await expect(new Order(order({ user: undefined })).validate()).rejects.toThrow();
    await expect(new Order(order({ orderNo: 'WSM-12' })).validate()).rejects.toThrow();
    await expect(new Order(order({ items: [] })).validate()).rejects.toThrow();
    await expect(new Order(order({ status: 'shipped' })).validate()).rejects.toThrow();
    await expect(new Order(order({ paymentMethod: 'card' })).validate()).rejects.toThrow();
  });
  it('a product line needs its product ref; a box line does not', async () => {
    await expect(new Order(order({ items: [item({ product: null })] })).validate()).rejects.toThrow();
    const box = item({ kind: 'box', product: null, products: [oid(), oid(), oid()], slug: 'box', slugs: ['awal', 'fajr', 'bar'] });
    await expect(new Order(order({ items: [box] })).validate()).resolves.toBeUndefined();
    await expect(new Order(order({ items: [item({ quantity: 100 })] })).validate()).rejects.toThrow();
  });
  it('newOrderNo gives WSM- + 6 digits', () => {
    for (let i = 0; i < 50; i += 1) expect(newOrderNo()).toMatch(/^WSM-[1-9]\d{5}$/);
  });
});

describe('User model', () => {
  it('lowercases/trims the email and never serialises passwordHash', () => {
    const u = new User({ name: ' سعود ', email: '  Soud@Gmail.COM ', passwordHash: '$2b$12$' + 'a'.repeat(53) });
    expect(u.email).toBe('soud@gmail.com');
    expect(u.name).toBe('سعود');
    expect(JSON.stringify(u)).not.toContain('passwordHash');
    expect(u.toObject()).not.toHaveProperty('passwordHash');
    expect(u.toJSON()).not.toHaveProperty('passwordHash');
  });
  it('excludes passwordHash from queries by default', () => {
    expect(User.schema.path('passwordHash').options.select).toBe(false);
  });
});
