import { getSession } from '@/lib/auth';
import { apiError, errorResponse, json } from '@/lib/http';
import { deleteOwnReview } from '@/lib/reviews';

export const dynamic = 'force-dynamic';

// DELETE /api/reviews/:id — deletes the signed-in user's own review. 404 for an unknown id, someone else's review or a
// sample review (it is never revealed which).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session.ok) return json({ error: 'سجّل دخولك أول', reason: session.reason }, 401);
    const { id } = await params;
    const deleted = await deleteOwnReview(session.userId, id);
    return deleted ? json({ ok: true }) : apiError(404, 'المراجعة مو موجودة');
  } catch (error) {
    return errorResponse(error);
  }
}
