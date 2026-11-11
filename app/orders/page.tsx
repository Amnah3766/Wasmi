import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DbDown } from '@/components/DbDown';
import { OrdersList } from '@/components/views/OrdersViews';
import { getSessionUser } from '@/lib/auth';
import { isDatabaseUnavailable } from '@/lib/errors';
import { listOrdersForUser } from '@/lib/orders';
import type { PublicOrder } from '@/lib/shop/types';
import { arabicDate } from '@/lib/time';

// Protected page. No loading.tsx here on purpose, so a signed-out visitor gets a real 307 redirect to /login.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'طلباتي', robots: { index: false } };

export default async function OrdersPage() {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect('/login?next=' + encodeURIComponent('/orders'));
  let orders: PublicOrder[];
  try {
    orders = await listOrdersForUser(user.id);
  } catch (error) {
    if (isDatabaseUnavailable(error)) return <DbDown />;
    throw error;
  }
  const dates = Object.fromEntries(orders.map((o) => [o.id, o.createdAt ? arabicDate(o.createdAt) : '']));
  const paidDates = Object.fromEntries(orders.filter((o) => o.paidAt).map((o) => [o.id, arabicDate(o.paidAt!)]));
  return <OrdersList name={user.name} orders={orders} dates={dates} paidDates={paidDates} />;
}
