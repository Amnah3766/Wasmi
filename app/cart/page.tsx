import type { Metadata } from 'next';
import { CartView } from '@/components/views/CheckoutView';

export const metadata: Metadata = { title: 'السلة' };

export default function CartPage() {
  return <CartView />;
}
