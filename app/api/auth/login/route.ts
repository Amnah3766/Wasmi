import { isHttps, sessionCookie } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { apiError, errorResponse, json, readJson } from '@/lib/http';
import { verifyPassword } from '@/lib/password';
import { signSession } from '@/lib/session';
import { publicUser } from '@/lib/users';
import { validateLogin } from '@/lib/validators';
import { User } from '@/models/User';

export const dynamic = 'force-dynamic';

// POST /api/auth/login — { email, password } → 200 { user } + HttpOnly session cookie, or 401.
// The 401 message is the same for an unknown email and a wrong password, and an unknown email still costs one bcrypt
// comparison (against a dummy hash), so neither the message nor the timing reveals which emails have accounts.
export async function POST(request: Request) {
  try {
    const result = validateLogin(await readJson(request));
    if (!result.ok) return apiError(400, 'اكتب الإيميل وكلمة السر', result.errors);
    const { email, password } = result.data;
    await connectDB();
    const user = await User.findOne({ email }).select('+passwordHash');
    const valid = await verifyPassword(password, user?.passwordHash ?? null);
    if (!user || !valid) return apiError(401, 'الإيميل أو كلمة السر غلط');
    const token = signSession({ id: String(user._id), name: user.name });
    const response = json({ user: publicUser(user) }, 200);
    response.cookies.set(sessionCookie(token, isHttps(request)));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
