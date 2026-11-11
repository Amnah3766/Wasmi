import { getSession } from '@/lib/auth';
import { confirmCheckoutForUser } from '@/lib/checkout';
import { errorResponse, isSameOrigin, json, readJson } from '@/lib/http';
import { isCheckoutSessionId } from '@/lib/stripeCore';

export const dynamic = 'force-dynamic';

// POST /api/checkout/confirm — { sessionId } → { status: 'paid', order } | { status: 'processing' | 'open' | 'expired' }
// Used by /checkout/success without a page reload: the server re-reads the session FROM STRIPE, checks it belongs to
// the signed-in user (another account's session → 404) and, once paid, saves the order in MongoDB with status "paid".
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return json({ error: 'الطلب لازم يكون من نفس الموقع' }, 403);
    const session = await getSession();
    if (!session.ok) return json({ error: 'سجّل دخولك عشان نتأكد من الدفع', reason: session.reason }, 401);
    const body = (await readJson(request)) as { sessionId?: unknown } | null;
    const sessionId = body?.sessionId;
    if (!isCheckoutSessionId(sessionId)) return json({ error: 'رقم جلسة الدفع مو صحيح' }, 400);
    return json(await confirmCheckoutForUser(session.userId, sessionId));
  } catch (error) {
    return errorResponse(error);
  }
}
