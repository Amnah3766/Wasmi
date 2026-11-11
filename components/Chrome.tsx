'use client';
// Site chrome ported from the original: announcement bar, sticky nav (+ Day 4 account entry), footer, cart drawer,
// scrim, toast, theme toggle and old hash-link redirects (#shop → /products, #p-awal → /products/awal …).
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { FREE_SHIPPING_FROM } from '@/lib/shop/pricing';
import { Icon, LogoMark } from './Icon';
import { KEYS, storage, useStore } from './store/StoreProvider';
import { Price } from './ui';

const NAV: Array<[href: string, label: string]> = [
  ['/products', 'المتجر'],
  ['/finder', 'اكتشف ريحتك'],
  ['/gift', 'صندوق المواسم'],
  ['/story', 'قصتنا'],
  ['/brand', 'الهوية'],
  ['/contact', 'تواصل'],
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

export function Announce() {
  return (
    <div className="announce" id="announce">
      <div className="wrap">
        توصيل مجاني فوق{' '}
        <b>
          <Price value={FREE_SHIPPING_FROM} />
        </b>{' '}
        · كود <b dir="ltr">WASMI10</b> يعطيك خصم 10%
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const effectiveDark = () => {
    const t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  };
  useEffect(() => {
    setMounted(true);
    setDark(effectiveDark());
  }, []);
  const label = dark ? 'التبديل للوضع الفاتح' : 'التبديل للوضع الليلي';
  return (
    <button
      className="ib"
      id="theme"
      type="button"
      aria-label={mounted ? label : 'تبديل الوضع الليلي'}
      onClick={() => {
        const n = effectiveDark() ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', n);
        storage.set(KEYS.theme, n);
        setDark(n === 'dark');
      }}
    >
      <Icon name={mounted && dark ? 'sun' : 'moon'} />
    </button>
  );
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    window.location.assign(window.location.pathname.startsWith('/orders') ? '/' : window.location.pathname);
  }
}

export function Nav() {
  const pathname = usePathname() || '/';
  const { favs, cartCount, ready, openDrawer, closeDrawer, cartBtnRef, favBtnRef, user } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the drawer and the mobile menu on every route change (original paint()).
  useEffect(() => {
    setMenuOpen(false);
    closeDrawer(true);
  }, [pathname, closeDrawer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDrawer();
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeDrawer]);

  const links = NAV.map(([href, label]) => (
    <Link key={href} href={href} aria-current={isActive(pathname, href) ? 'page' : undefined}>
      {label}
    </Link>
  ));
  const nextParam = pathname.startsWith('/login') || pathname.startsWith('/signup') ? '' : '?next=' + encodeURIComponent(pathname);

  return (
    <header className="nav">
      <div className="wrap">
        <Link className="logo" href="/" aria-label="وسمي، الصفحة الرئيسية">
          <LogoMark />
          <span>
            <b>وسمي</b>
            <small>WASMI</small>
          </span>
        </Link>
        <nav className="links" aria-label="التنقل" id="links">
          {links}
        </nav>
        <div className="actions">
          {user ? (
            <span className="acct" data-testid="nav-user">
              <Link className="acct-name" href="/orders" title="طلباتي">
                <Icon name="user" />
                <span>{user.name}</span>
              </Link>
              <button className="ib acct-out" type="button" aria-label="تسجيل الخروج" title="تسجيل الخروج" onClick={logout}>
                <Icon name="logout" />
              </button>
            </span>
          ) : (
            <Link className="btn line sm acct-in" href={'/login' + nextParam}>
              دخول
            </Link>
          )}
          <ThemeToggle />
          <Link className="ib" href="/favorites" aria-label="المفضلة" ref={favBtnRef}>
            <Icon name="heart" />
            <span className="badge" id="favN" hidden={!ready || !favs.size}>
              {favs.size}
            </span>
          </Link>
          <button className="ib" id="navCart" type="button" aria-label="السلة" ref={cartBtnRef} onClick={openDrawer}>
            <Icon name="bag" />
            <span className="badge" id="cartN" hidden={!ready || !cartCount}>
              {cartCount}
            </span>
          </button>
          <button
            className="ib menu-btn"
            id="menuBtn"
            type="button"
            aria-label="القائمة"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <Icon name="menu" />
          </button>
        </div>
      </div>
      <div className="mnav" id="mnav" hidden={!menuOpen} onClick={(e) => (e.target as HTMLElement).closest('a') && setMenuOpen(false)}>
        {user ? (
          <div className="mnav-user" data-testid="mnav-user">
            <span>
              أهلًا، <b>{user.name}</b>
            </span>
          </div>
        ) : null}
        {links}
        {user ? (
          <>
            <Link href="/orders">طلباتي</Link>
            <button className="mnav-btn" type="button" onClick={logout}>
              تسجيل الخروج
            </button>
          </>
        ) : (
          <>
            <Link href={'/login' + nextParam}>تسجيل الدخول</Link>
            <Link href="/signup">حساب جديد</Link>
          </>
        )}
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="foot" id="foot">
      <div className="wrap">
        <div>
          <div className="logo" style={{ color: 'var(--hero-fg)' }}>
            <LogoMark />
            <span>
              <b>وسمي</b>
              <small>WASMI</small>
            </span>
          </div>
          <p>شموع وعطور وبخور مصبوبة بدفعات صغيرة، كل واحدة تحكي لحظة من الخليج.</p>
        </div>
        <div>
          <h4>الصفحات</h4>
          <Link href="/products">المتجر</Link>
          <Link href="/finder">اكتشف ريحتك</Link>
          <Link href="/gift">صندوق المواسم</Link>
          <Link href="/favorites">المفضلة</Link>
        </div>
        <div>
          <h4>وسمي</h4>
          <Link href="/story">قصتنا</Link>
          <Link href="/brand">الهوية</Link>
          <Link href="/contact">تواصل</Link>
          <Link href="/orders">طلباتي</Link>
        </div>
      </div>
      <div className="legal">
        <div className="wrap">
          <span>وسمي · مشروع تصميم متجر إلكتروني</span>
          <span>المنتجات والأسعار تجريبية</span>
        </div>
      </div>
    </footer>
  );
}

export function PromoBox() {
  const { promo, applyPromo } = useStore();
  const [value, setValue] = useState(promo);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  useEffect(() => setValue(promo), [promo]);
  const shown = msg ?? (promo ? { text: 'تم تطبيق ' + promo, ok: true } : { text: 'جرّب WASMI10', ok: false });
  return (
    <>
      <div className="promo">
        <input className="field" placeholder="كود الخصم" dir="ltr" value={value} aria-label="كود الخصم" onChange={(e) => setValue(e.target.value)} />
        <button
          className="btn line sm"
          type="button"
          onClick={() => {
            const r = applyPromo(value);
            setMsg(r === 'invalid' ? { text: 'هذا الكود غير صحيح', ok: false } : null);
          }}
        >
          تطبيق
        </button>
      </div>
      <div className={'pmsg' + (shown.ok ? ' ok' : '')} id="pmsg">
        {shown.text}
      </div>
    </>
  );
}

export function CartDrawer() {
  const { cart, totals, unit, lineInfo, changeQty, removeLine, drawerOpen, closeDrawer, ready } = useStore();
  const closeRef = useRef<HTMLButtonElement>(null);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d) d.inert = !drawerOpen;
    if (drawerOpen) setTimeout(() => closeRef.current?.focus(), 50);
  }, [drawerOpen]);

  const rows = cart.map((l, i) => ({ l, i, n: lineInfo(l) })).filter((r) => r.n);
  const left = Math.max(0, FREE_SHIPPING_FROM - totals.after);
  const pct = Math.min(100, (totals.after / FREE_SHIPPING_FROM) * 100);

  return (
    <>
      <div className={'scrim' + (drawerOpen ? ' on' : '')} id="scrim" onClick={() => closeDrawer()} />
      <aside className={'drawer' + (drawerOpen ? ' open' : '')} id="drawer" aria-label="السلة" ref={ref}>
        <div className="dh">
          <h2>سلتك</h2>
          <button className="ib" id="dClose" type="button" aria-label="إغلاق السلة" ref={closeRef} onClick={() => closeDrawer()}>
            <Icon name="close" />
          </button>
        </div>
        {!ready || !rows.length ? (
          <div className="dempty">
            <p>سلتك فاضية. اختر ريحة تبدأ فيها.</p>
            <Link className="btn" href="/products" onClick={() => closeDrawer(true)}>
              تصفح الروائح
            </Link>
          </div>
        ) : (
          <>
            <div className="ship">
              {left > 0 ? (
                <>
                  باقي{' '}
                  <b>
                    <Price value={left} />
                  </b>{' '}
                  ويصير التوصيل مجاني
                </>
              ) : (
                'التوصيل مجاني لطلبك'
              )}
              <div className="bar">
                <i style={{ width: pct + '%' }} />
              </div>
            </div>
            <ul className="dlist">
              {rows.map(({ l, i, n }) => (
                <li
                  className="row"
                  key={i + ':' + l.t}
                  data-i={i}
                  style={{ ['--c1' as string]: n!.c1, ['--c2' as string]: n!.c2, ['--c3' as string]: n!.c3 }}
                >
                  <span className={'thumb' + (n!.box ? ' box' : '')} />
                  <div className="rt">
                    <b>{n!.name}</b>
                    <small>{n!.sub}</small>
                    <div className="qty">
                      <button type="button" aria-label="نقّص الكمية" onClick={() => changeQty(i, -1)}>
                        −
                      </button>
                      <span>{l.q}</span>
                      <button type="button" aria-label="زد الكمية" onClick={() => changeQty(i, 1)}>
                        +
                      </button>
                    </div>
                  </div>
                  <div className="rp">
                    <span>
                      <Price value={unit(l) * l.q} />
                    </span>
                    <button type="button" aria-label={'احذف ' + n!.name} onClick={() => removeLine(i)}>
                      <Icon name="trash" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="df">
              <PromoBox />
              <div className="ln">
                <span>المجموع</span>
                <span>
                  <Price value={totals.sub} />
                </span>
              </div>
              {totals.disc ? (
                <div className="ln sv">
                  <span>خصم</span>
                  <span>
                    <Price value={totals.disc} minus />
                  </span>
                </div>
              ) : null}
              <div className="ln tot">
                <span>الإجمالي</span>
                <span>
                  <Price value={totals.total} />
                </span>
              </div>
              <Link className="btn primary" href="/checkout" onClick={() => closeDrawer(true)}>
                أكمل الطلب
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

export function Toast() {
  const { toastState } = useStore();
  return (
    <div className={'toast' + (toastState.on ? ' on' : '')} id="toast" role="status" aria-live="polite">
      {toastState.msg}
    </div>
  );
}

/** The app wrapper: keeps the original #app element (dir/lang + has-bar class for the product buy bar). */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const { hasBar } = useStore();
  return (
    <div dir="rtl" lang="ar" id="app" className={hasBar ? 'has-bar' : undefined}>
      {children}
    </div>
  );
}

const HASH_ROUTES: Record<string, string> = {
  home: '/',
  shop: '/products',
  finder: '/finder',
  gift: '/gift',
  story: '/story',
  brand: '/brand',
  contact: '/contact',
  favorites: '/favorites',
  checkout: '/checkout',
  order: '/orders',
};

/** Old links like /#shop or /#p-awal (from the hash-routed version) land on the new real routes. */
export function HashRedirect() {
  const router = useRouter();
  useEffect(() => {
    const go = () => {
      const h = (window.location.hash || '').replace(/^#/, '');
      if (!h) return;
      let to: string | undefined = HASH_ROUTES[h];
      if (!to && /^p-[a-z0-9-]{2,40}$/.test(h)) to = '/products/' + h.slice(2);
      if (to) router.replace(to);
    };
    go();
    window.addEventListener('hashchange', go);
    return () => window.removeEventListener('hashchange', go);
  }, [router]);
  return null;
}
