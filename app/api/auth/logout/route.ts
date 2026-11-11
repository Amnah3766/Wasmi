import { clearedSessionCookie, isHttps } from '@/lib/auth';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';

// POST /api/auth/logout — clears the session cookie (works even when signed out).
export async function POST(request: Request) {
  const response = json({ ok: true }, 200);
  response.cookies.set(clearedSessionCookie(isHttps(request)));
  return response;
}
