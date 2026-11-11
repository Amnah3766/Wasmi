import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { DbDown } from '@/components/DbDown';
import { OrderDetail } from '@/components/views/OrdersViews';
import { getSessionUser } from '@/lib/auth';
import { isDatabaseUnavailable } from '@/lib/errors';
import { getOrderForUser } from '@/lib/orders';
import type { PublicOrder } from '@/lib/shop/types';
import { arabicDate } from '@/lib/time';

// Protected page: 307 to /login when signed out; 404 for an unknown order or one that belongs to another user.
// No loading.tsx on purpose (real status codes).
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'تفاصيل الطلب', robots: { index: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string }> };

export default async function OrderPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { placed } = await searchParams;
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect('/login?next=' + encodeURIComponent('/orders/' + id));
  let order: PublicOrder | null;
  try {
    order = await getOrderForUser(user.id, id);
  } catch (error) {
    if (isDatabaseUnavailable(error)) return <DbDown />;
    throw error;
  }
  if (!order) notFound();
  return <OrderDetail order={order} placed={placed === '1'} date={order.createdAt ? arabicDate(order.createdAt) : ''} paidDate={order.paidAt ? arabicDate(order.paidAt) : ''} />;
}
