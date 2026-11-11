import { getSession } from '@/lib/auth';
import { apiError, errorResponse, json } from '@/lib/http';
import { ORDER_NOT_FOUND, getOrderForUser } from '@/lib/orders';

export const dynamic = 'force-dynamic';

// GET /api/orders/:id — one order, matched by BOTH the order id and the signed-in owner.
// An invalid id, an unknown id and another user's order all give the same 404.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session.ok) return json({ error: 'سجّل دخولك عشان تشوف الطلب', reason: session.reason }, 401);
    const { id } = await params;
    const order = await getOrderForUser(session.userId, id);
    return order ? json({ order }) : apiError(404, ORDER_NOT_FOUND);
  } catch (error) {
    return errorResponse(error);
  }
}
