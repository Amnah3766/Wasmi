import { isHttps, sessionCookie } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { apiError, errorResponse, json, readJson } from '@/lib/http';
import { hashPassword } from '@/lib/password';
import { signSession } from '@/lib/session';
import { publicUser } from '@/lib/users';
import { validateSignup } from '@/lib/validators';
import { User } from '@/models/User';

export const dynamic = 'force-dynamic';

const TAKEN = 'هذا الإيميل مسجّل قبل';

// POST /api/auth/signup — { name, email, password } → 201 { user } + HttpOnly session cookie (signed in right away).
// Validates on the server, rejects duplicate emails (409), stores ONLY a bcrypt hash (cost 12) and never returns it.
export async function POST(request: Request) {
  try {
    const result = validateSignup(await readJson(request));
    if (!result.ok) return apiError(400, 'راجع البيانات المطلوبة', result.errors);
    const { name, email, password } = result.data;
    await connectDB();
    if (await User.exists({ email })) return apiError(409, TAKEN, { email: 'taken' });
    const passwordHash = await hashPassword(password);
    let user;
    try {
      user = await User.create({ name, email, passwordHash });
    } catch (error) {
      // Two sign-ups racing for the same email: the unique index decides.
      if ((error as { code?: number }).code === 11000) return apiError(409, TAKEN, { email: 'taken' });
      throw error;
    }
    const token = signSession({ id: String(user._id), name: user.name });
    const response = json({ user: publicUser(user) }, 201);
    response.cookies.set(sessionCookie(token, isHttps(request)));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
