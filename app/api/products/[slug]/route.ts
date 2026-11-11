import { getProduct } from '@/lib/catalog';
import { apiError, errorResponse, json } from '@/lib/http';

export const dynamic = 'force-dynamic';

// GET /api/products/:slug — one product, or 404.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const product = await getProduct(slug);
    return product ? json({ product }) : apiError(404, 'المنتج مو موجود');
  } catch (error) {
    return errorResponse(error);
  }
}
