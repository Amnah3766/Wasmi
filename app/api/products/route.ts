import { getCatalog } from '@/lib/catalog';
import { errorResponse, json } from '@/lib/http';

export const dynamic = 'force-dynamic';

// GET /api/products — the whole catalog from MongoDB (sorted by sortOrder, with ratings from reviews).
export async function GET() {
  try {
    return json({ products: await getCatalog() });
  } catch (error) {
    return errorResponse(error);
  }
}
