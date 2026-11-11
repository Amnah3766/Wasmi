// UI copy shared by the browser and the server (order snapshots). Labels only — no product data.
import type { Category } from './types';

export const CATEGORY_LABEL: Readonly<Record<Category, string>> = { candle: 'شمعة', perfume: 'عطر', incense: 'بخور' };

export const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'] as const;

export const DELIVERY_SLOTS = ['صباحًا (9-12)', 'عصرًا (3-6)', 'مساءً (6-9)'] as const;

export const PAYMENT_LABEL = { cod: 'الدفع عند الاستلام', link: 'رابط دفع إلكتروني', stripe: 'بطاقة عبر Stripe (وضع تجريبي)' } as const;

export const ORDER_STATUS_LABEL = { pending: 'استلمنا طلبك', paid: 'مدفوع' } as const;

export const BOX_NAME = 'صندوق المواسم';
