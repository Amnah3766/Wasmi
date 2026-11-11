import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { json } from '@/lib/http';
import { paymentsStatus } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

// GET /api/health — yes/no only, never a value or part of one:
//   db: MongoDB answered a ping ('up' | 'down') · database / sessions / webhook: the setting is present
//   payments: 'ready' | 'missing' | 'malformed' | 'live' (only a Stripe TEST key is accepted)
// 200 when the database is up, 503 when it is not.
export async function GET() {
  const settings = {
    database: Boolean(process.env.MONGODB_URI?.trim()),
    sessions: Boolean(process.env.JWT_SECRET?.trim()),
    payments: paymentsStatus(),
    webhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
  };
  try {
    await connectDB();
    await mongoose.connection.db?.admin().ping();
    if (mongoose.connection.readyState !== 1) throw new Error('not connected');
    return json({ ok: true, db: 'up', ...settings });
  } catch (error) {
    console.error(`[health] database check failed: ${(error as { name?: string })?.name ?? 'Error'}`);
    return json({ ok: false, db: 'down', ...settings }, 503);
  }
}
