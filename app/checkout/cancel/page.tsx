import type { Metadata } from 'next';
import { CheckoutCancelView } from '@/components/views/PaymentViews';

export const metadata: Metadata = { title: 'انلغى الدفع', robots: { index: false, follow: false } };

// Stripe's cancel_url. Nothing was charged and no order exists for an unpaid session; the cart is untouched.
export default function CheckoutCancelPage() {
  return <CheckoutCancelView />;
}
