import { clearedSessionCookie, getSession, isHttps } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { errorResponse, json } from '@/lib/http';
import { publicUser } from '@/lib/users';
import { User } from '@/models/User';

export const dynamic = 'force-dynamic';

const MESSAGES = {
  missing: 'مو مسجّل دخول',
  invalid: 'جلستك مو صالحة، سجّل دخولك مرة ثانية',
  expired: 'انتهت جلستك، سجّل دخولك مرة ثانية',
} as const;

// GET /api/auth/me — the signed-in user (from the verified cookie + the database), or 401 with the reason.
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session.ok) return json({ error: MESSAGES[session.reason], reason: session.reason }, 401);
    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) {
      // Valid token for an account that no longer exists: sign the browser out.
      const response = json({ error: MESSAGES.invalid, reason: 'invalid' }, 401);
      response.cookies.set(clearedSessionCookie(isHttps(request)));
      return response;
    }
    return json({ user: publicUser(user) });
  } catch (error) {
    return errorResponse(error);
  }
}
