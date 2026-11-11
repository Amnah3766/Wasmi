import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthView } from '@/components/views/AuthViews';
import { getSessionUser } from '@/lib/auth';
import { safeNext } from '@/lib/safeNext';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'حساب جديد' };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : '';
  const user = await getSessionUser().catch(() => null);
  if (user) redirect(safeNext(next, '/orders'));
  return <AuthView mode="signup" next={next} />;
}
