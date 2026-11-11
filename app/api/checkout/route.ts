import { getSession } from '@/lib/auth';
import { startCheckout } from '@/lib/checkout';
import { errorResponse, isSameOrigin, json, readJson, siteOrigin } from '@/lib/http';
import { validateCheckoutInput } from '@/lib/validators';

export const dynamic = 'force-dynamic';

// POST /api/checkout — { lines, promo, delivery } → 201 { url, sessionId } (Stripe Checkout, TEST MODE, KWD).
// The server-side "function" that starts the card payment (the class brief's Supabase Edge Function).
// 403 cross-site · 401 signed out · 400 invalid cart/delivery · 503 payments not configured · 502 Stripe error.
// Prices come from MongoDB; any price, total, user id or payment field in the body is ignored.
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return json({ error: 'الطلب لازم يكون من نفس الموقع' }, 403);
    const session = await getSession();
    if (!session.ok) return json({ error: 'سجّل دخولك عشان تدفع وينحفظ طلبك', reason: session.reason }, 401);
    const result = validateCheckoutInput(await readJson(request));
    if (!result.ok) return json({ error: 'راجع بيانات الطلب', fields: result.errors }, 400);
    return json(await startCheckout(session.userId, result.data, siteOrigin(request)), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
