import type { Metadata } from 'next';
import { CheckoutView } from '@/components/views/CheckoutView';

export const metadata: Metadata = { title: 'إتمام الطلب' };

export default function CheckoutPage() {
  return <CheckoutView />;
}
