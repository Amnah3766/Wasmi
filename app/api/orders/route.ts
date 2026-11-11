import { getSession } from '@/lib/auth';
import { apiError, errorResponse, json, readJson } from '@/lib/http';
import { SIGNED_OUT_ORDER, createOrderForUser, listOrdersForUser } from '@/lib/orders';
import { validateOrder } from '@/lib/validators';

export const dynamic = 'force-dynamic';

// GET /api/orders — the signed-in user's orders only, newest first (401 without a valid token).
export async function GET() {
  try {
    const session = await getSession();
    if (!session.ok) return json({ error: 'سجّل دخولك عشان تشوف طلباتك', reason: session.reason }, 401);
    return json({ orders: await listOrdersForUser(session.userId) });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/orders — { lines, promo, delivery, payment } → 201 { order }. The owner is the user in the token; any
// user / price / total field in the body is ignored and every amount is computed from MongoDB products.
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session.ok) return json({ error: SIGNED_OUT_ORDER, reason: session.reason }, 401);
    const result = validateOrder(await readJson(request));
    if (!result.ok) return apiError(400, 'راجع بيانات الطلب', result.errors);
    const order = await createOrderForUser(session.userId, result.data);
    return json({ order }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
