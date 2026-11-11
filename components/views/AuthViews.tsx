'use client';
// /signup and /login. The password goes only to our own API route over HTTPS; the server hashes it with bcrypt and
// answers with an HttpOnly session cookie (JavaScript here never sees the token).
import Link from 'next/link';
import { useState } from 'react';
import { safeNext } from '@/lib/safeNext';

const MSG: Record<string, Record<string, string>> = {
  name: { required: 'اكتب اسمك', tooLong: 'الاسم طويل، اختصره شوي' },
  email: { required: 'اكتب إيميلك', invalid: 'الإيميل مو صحيح', taken: 'هذا الإيميل مسجّل قبل، سجّل دخولك' },
  password: { required: 'اكتب كلمة السر', tooShort: 'كلمة السر لازم 8 أحرف على الأقل', tooLong: 'كلمة السر طويلة' },
};

type Mode = 'login' | 'signup';

function clientCheck(mode: Mode, f: { name: string; email: string; password: string }) {
  const e: Record<string, string> = {};
  if (mode === 'signup' && !f.name.trim()) e.name = MSG.name.required;
  if (!f.email.trim()) e.email = MSG.email.required;
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = MSG.email.invalid;
  if (!f.password) e.password = MSG.password.required;
  else if (mode === 'signup' && f.password.length < 8) e.password = MSG.password.tooShort;
  return e;
}

export function AuthView({ mode, next }: { mode: Mode; next: string }) {
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [formMsg, setFormMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const dest = safeNext(next, '/orders');
  const isSignup = mode === 'signup';
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg('');
    const v = clientCheck(mode, f);
    setErrs(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const res = await fetch('/api/auth/' + mode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(isSignup ? { name: f.name.trim(), email: f.email.trim(), password: f.password } : { email: f.email.trim(), password: f.password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // Full navigation so the server re-renders the navigation with the signed-in name.
        window.location.assign(dest);
        return;
      }
      if (data.fields) {
        const mapped: Record<string, string> = {};
        for (const [k, code] of Object.entries(data.fields as Record<string, string>)) mapped[k] = MSG[k]?.[code] ?? 'راجع هذا الحقل';
        setErrs(mapped);
      }
      setFormMsg(res.status === 401 ? 'الإيميل أو كلمة السر غلط' : data.error || 'صار خطأ، جرّب مرة ثانية.');
    } catch {
      setFormMsg('تأكد من الاتصال وجرّب مرة ثانية.');
    } finally {
      setBusy(false);
    }
  }

  const other = (isSignup ? '/login' : '/signup') + (next ? '?next=' + encodeURIComponent(dest) : '');

  return (
    <div className="wrap">
      <div className="authwrap">
        <div className="page-head">
          <span className="en">{isSignup ? 'Sign up' : 'Log in'}</span>
          <h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}>{isSignup ? 'حساب جديد' : 'تسجيل الدخول'}</h1>
          <p>{isSignup ? 'سوّ حسابك عشان تنحفظ طلباتك وتنشر مراجعاتك.' : 'أهلًا فيك من جديد. دخولك يحفظ طلباتك بحسابك.'}</p>
        </div>
        <form className="form authbox" noValidate onSubmit={submit} data-testid={mode + '-form'}>
          {isSignup ? (
            <div className="fld">
              <label htmlFor="an">الاسم</label>
              <input className={'field' + (errs.name ? ' bad' : '')} id="an" name="name" autoComplete="name" maxLength={80} value={f.name} onChange={set('name')} />
              <span className="err">{errs.name}</span>
            </div>
          ) : null}
          <div className="fld">
            <label htmlFor="ae">البريد الإلكتروني</label>
            <input className={'field' + (errs.email ? ' bad' : '')} id="ae" name="email" type="email" dir="ltr" autoComplete="email" value={f.email} onChange={set('email')} />
            <span className="err">{errs.email}</span>
          </div>
          <div className="fld">
            <label htmlFor="ap">كلمة السر</label>
            <input
              className={'field' + (errs.password ? ' bad' : '')}
              id="ap"
              name="password"
              type="password"
              dir="ltr"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={f.password}
              onChange={set('password')}
            />
            <span className="err">{errs.password || (isSignup ? '' : '')}</span>
            {isSignup ? <span className="muted hint">8 أحرف على الأقل.</span> : null}
          </div>
          <div>
            <button className="btn primary authbtn" type="submit" disabled={busy}>
              {busy ? (isSignup ? 'جاري إنشاء الحساب…' : 'جاري الدخول…') : isSignup ? 'سوّ الحساب' : 'دخول'}
            </button>
          </div>
          {formMsg ? (
            <p className="err" role="alert" style={{ margin: 0 }}>
              {formMsg}
            </p>
          ) : null}
          <p className="muted" style={{ margin: 0, fontSize: '.9rem' }}>
            {isSignup ? 'عندك حساب؟ ' : 'ما عندك حساب؟ '}
            <Link href={other} className="link">
              {isSignup ? 'سجّل دخولك' : 'سوّ حساب جديد'}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
