import { getSession, getSessionUser } from '@/lib/auth';
import { apiError, errorResponse, json, readJson } from '@/lib/http';
import { REVIEW_PRODUCT_NOT_FOUND, createReviewForUser, listReviewsForProduct } from '@/lib/reviews';
import { validateReview } from '@/lib/validators';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ slug: string }> };

// GET /api/products/:slug/reviews — samples + real reviews, newest first; `mine` comes from the session (404 if no product).
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { slug } = await params;
    const viewer = await getSessionUser(); // public route: a missing JWT_SECRET just means "nobody is signed in"
    const reviews = await listReviewsForProduct(slug, viewer?.id ?? null);
    return reviews ? json({ reviews }) : apiError(404, REVIEW_PRODUCT_NOT_FOUND);
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/products/:slug/reviews — { rating 1-5, text 10-400 } → 201 { review, reviews }. Signed-in users only;
// the author name is the account name from the token (any name/user in the body is ignored).
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { slug } = await params;
    const session = await getSession();
    if (!session.ok) return json({ error: 'سجّل دخولك عشان تكتب مراجعة', reason: session.reason }, 401);
    const result = validateReview(await readJson(request));
    if (!result.ok) return apiError(400, 'راجع التقييم والمراجعة', result.errors);
    const { review, reviews } = await createReviewForUser({ id: session.userId, name: session.name }, slug, result.data);
    return json({ review, reviews }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
