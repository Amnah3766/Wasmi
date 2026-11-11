import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { preconnect } from 'react-dom';
import { AppFrame, Announce, CartDrawer, Footer, HashRedirect, Nav, Toast } from '@/components/Chrome';
import { StoreProvider } from '@/components/store/StoreProvider';
import { getSessionUser } from '@/lib/auth';
import { getCatalog } from '@/lib/catalog';
import { kuwaitMonth } from '@/lib/time';
import type { CatalogProduct, SessionUser } from '@/lib/shop/types';
import './wasmi.css';
import './tailwind.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'وسمي Wasmi', template: '%s · وسمي Wasmi' },
  description: 'شموع وعطور وبخور من أجواء الخليج، مصبوبة يدويًا بدفعات صغيرة. كل ريحة تحكي لحظة: التراب بعد أول مطر، الشط قبل الفجر، قهوة الصباح.',
  icons: { icon: { url: '/favicon.svg', type: 'image/svg+xml' } },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1E120B',
};

// Applies the visitor's saved light/dark choice before first paint (same storage key as the original store).
const PREPAINT = `(function(){try{var t=JSON.parse(localStorage.getItem('wasmi2.theme')||'""');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})();`;

const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=Reem+Kufi:wght@500;600;700&display=swap';

export default async function RootLayout({ children }: { children: ReactNode }) {
  preconnect('https://fonts.googleapis.com');
  preconnect('https://fonts.gstatic.com', { crossOrigin: '' });
  // Products come only from MongoDB. If the database is unreachable, the pages show a notice instead of crashing.
  let products: CatalogProduct[] = [];
  let dbDown = false;
  try {
    products = await getCatalog();
  } catch {
    dbDown = true;
  }
  let user: SessionUser | null = null;
  try {
    user = await getSessionUser();
  } catch {
    user = null;
  }

  return (
    // No explicit <head> element: Netlify injects "\n<!-- hosted on Netlify -->" after the charset meta, and an explicit
    // <head> makes React hydrate its children strictly → React #418 on every page. React hoists the font resources below.
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body>
        {/* First thing in <body>, not in <head>: an inline script in <head> would hit the same injection problem.
            Here it still runs before anything is painted. */}
        <script dangerouslySetInnerHTML={{ __html: PREPAINT }} />
        {/* Same Google Fonts as the original page (IBM Plex Sans Arabic + Reem Kufi); React hoists it into <head>. */}
        <link rel="stylesheet" href={FONTS_CSS} precedence="default" />
        <StoreProvider products={products} now={kuwaitMonth()} dbDown={dbDown} user={user}>
          <AppFrame>
            <Announce />
            <Nav />
            <main id="view" tabIndex={-1}>
              {children}
            </main>
            <Footer />
            <CartDrawer />
            <Toast />
            <HashRedirect />
          </AppFrame>
        </StoreProvider>
      </body>
    </html>
  );
}
