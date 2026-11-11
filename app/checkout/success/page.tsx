import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CheckoutSuccessView } from '@/components/views/PaymentViews';
import { getSessionUser } from '@/lib/auth';
import { isCheckoutSessionId } from '@/lib/stripeCore';

export const metadata: Metadata = { title: 'تم الدفع', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Stripe's success_url: /checkout/success?session_id={CHECKOUT_SESSION_ID}. PROTECTED (the order belongs to the
// signed-in account; signed out → 307 to /login with next). The payment itself is confirmed by the client view
// through POST /api/checkout/confirm. No loading.tsx here on purpose (real redirect status).
export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string | string[] }> }) {
  const params = await searchParams;
  const raw = Array.isArray(params.session_id) ? params.session_id[0] : params.session_id;
  const sessionId = isCheckoutSessionId(raw) ? raw : null;
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect('/login?next=' + encodeURIComponent('/checkout/success' + (sessionId ? '?session_id=' + sessionId : '')));
  return <CheckoutSuccessView sessionId={sessionId} />;
}
