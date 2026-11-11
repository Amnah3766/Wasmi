import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DbDown } from '@/components/DbDown';
import { ProductView } from '@/components/views/ProductView';
import { getSessionUser } from '@/lib/auth';
import { getProduct } from '@/lib/catalog';
import { isDatabaseUnavailable } from '@/lib/errors';
import { listReviewsForProduct } from '@/lib/reviews';
import type { CatalogProduct, PublicReview } from '@/lib/shop/types';

// No loading.tsx on this route on purpose: an unknown slug must answer with a real 404 status.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const p = await getProduct(slug);
    if (!p) return { title: 'الريحة مو موجودة' };
    return { title: p.name, description: p.description, openGraph: { images: [p.image] } };
  } catch {
    return { title: 'المتجر' };
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) notFound();

  let product: CatalogProduct | null;
  try {
    product = await getProduct(slug);
  } catch (error) {
    if (isDatabaseUnavailable(error)) return <DbDown />;
    throw error;
  }
  if (!product) notFound();

  const user = await getSessionUser().catch(() => null);
  let reviews: PublicReview[] = [];
  let reviewsFailed = false;
  try {
    reviews = (await listReviewsForProduct(slug, user?.id ?? null)) ?? [];
  } catch {
    reviewsFailed = true;
  }
  return <ProductView product={product} initialReviews={reviews} reviewsFailed={reviewsFailed} />;
}
