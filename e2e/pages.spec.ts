// The ported pages keep the original store's sections and interactions (desktop + mobile).
import { expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

const ROUTES = ['/', '/products', '/products/awal', '/finder', '/gift', '/favorites', '/story', '/brand', '/contact', '/cart', '/checkout', '/login', '/signup'];

test('every page answers 200, renders RTL Arabic, has no console errors and no sideways scroll', async ({ page }) => {
  const errors = trackErrors(page);
  for (const r of ROUTES) {
    const res = await page.goto(r);
    expect(res?.status(), r).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('#app')).toHaveAttribute('lang', 'ar');
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, r + ' horizontal overflow').toBeLessThanOrEqual(1);
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

test('unknown product → real 404', async ({ page, request }) => {
  const res = await page.goto('/products/no-such-scent');
  expect(res?.status()).toBe(404);
  await expect(page.locator('h1')).toContainText('ما لقينا');
  expect((await request.get('/api/products/no-such-scent')).status()).toBe(404);
});

test('home: hero, in-season, calendar (12 scents × 12 months), finder band, ad, gift band', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hero h1')).toHaveText('وسمي');
  await expect(page.locator('.hero-tag')).toContainText('تراب الوسمي');
  await expect(page.locator('section.wrap.sec h2').first()).toHaveText('بموسمها الحين');
  await expect(page.locator('.calg .nmc')).toHaveCount(12);
  await expect(page.locator('.calg .h')).toHaveCount(13);
  await expect(page.locator('.band h2').first()).toHaveText('ما تدري أي ريحة تناسبك؟');
  await expect(page.locator('#adsec .beats li')).toHaveCount(5);
  await expect(page.locator('.band h2').nth(1)).toHaveText('هدية ما تنساها');
  await expect(page.locator('.marq .track span')).toHaveCount(24);
});

test('shop: 12 products from the API, search + category + season filters', async ({ page, request }) => {
  const api = await request.get('/api/products');
  const { products } = await api.json();
  expect(products).toHaveLength(12);
  await page.goto('/products');
  await expect(page.locator('#shopgrid .card')).toHaveCount(12);
  for (const p of products) await expect(page.locator(`.card[data-id="${p.slug}"] h3`)).toHaveText(p.name);
  await page.fill('#q', 'عود');
  await expect(page.locator('#shopgrid .card')).toHaveCount(4);
  await page.fill('#q', '');
  await page.locator('.chip[data-cat="perfume"]').click();
  await expect(page.locator('#shopgrid .card')).toHaveCount(4);
  await page.locator('.chip[data-cat="all"]').click();
  await page.locator('.card .art').first().click();
  await expect(page.locator('.art-wrap.show')).toHaveCount(1);
});

test('product page sections + size changes price + rail + pairing', async ({ page }) => {
  await page.goto('/products/awal');
  await expect(page.locator('.pinfo h1')).toHaveText('تراب الوسمي');
  for (const h of ['قصة الريحة', 'طبقات الريحة', 'تناسبك إذا', 'تكمّلها بـ', 'تقييمات الناس', 'تنقل بين الروائح']) {
    await expect(page.locator('h2', { hasText: h }).first()).toBeVisible();
  }
  await expect(page.getByTestId('pdp-price')).toHaveText('9.500 د.ك');
  await page.locator('#vopts .opt').first().click();
  await expect(page.getByTestId('pdp-price')).toHaveText('6.250 د.ك');
  await page.locator('.qty button[aria-label="زد"]').click();
  await expect(page.getByTestId('pdp-price')).toHaveText('12.500 د.ك');
  await expect(page.locator('#rail .rl')).toHaveCount(12);
  await expect(page.locator('.pair h3')).toHaveText('عود كمبودي');
  await expect(page.locator('#revlist .rvi')).not.toHaveCount(0);
  await page.goto('/products/ghaim');
  await expect(page.locator('h2', { hasText: 'شفتها قبل' })).toBeVisible();
});

test('price text never flips in RTL (number reads first, currency after)', async ({ page }) => {
  await page.goto('/products/awal');
  const order = await page.getByTestId('pdp-price').locator('.pv').evaluate((el) => {
    const node = el.firstChild as Text;
    const txt = node.textContent || '';
    const r = (from: number, to: number) => {
      const range = document.createRange();
      range.setStart(node, from);
      range.setEnd(node, to);
      return range.getBoundingClientRect();
    };
    const num = r(0, txt.indexOf(' '));
    const cur = r(txt.indexOf('د'), txt.length);
    return { txt, numLeft: num.left, curLeft: cur.left };
  });
  expect(order.txt).toBe('9.500 د.ك');
  // In RTL the number sits to the right of "د.ك".
  expect(order.numLeft).toBeGreaterThan(order.curLeft);
});

test('finder quiz → recommendation', async ({ page }) => {
  await page.goto('/finder');
  await page.locator('.fo[data-v="calm"]').click();
  await page.locator('.fo[data-v="night"]').click();
  await page.locator('.fo[data-v="incense"]').click();
  await expect(page.locator('#fbox h2')).toContainText('تناسبك');
  await expect(page.locator('.pct')).toContainText('%');
  await expect(page.locator('#fbox .grid.g3 .card')).toHaveCount(2);
});

test('gift box: pick 3 → 15 % off → into the cart', async ({ page }) => {
  await page.goto('/gift');
  const add = page.locator('.gbox .btn.primary');
  await expect(add).toBeDisabled();
  for (const n of ['تراب الوسمي', 'زعفران الرمل', 'عود كمبودي']) await page.locator('.pk', { hasText: n }).click();
  await expect(page.locator('.ln.tot')).toContainText('35.250 د.ك');
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.locator('#cartN')).toHaveText('1');
  await page.locator('#navCart').click();
  await expect(page.locator('#drawer.open .row')).toHaveCount(1);
  await expect(page.locator('#drawer .rt b')).toHaveText('صندوق المواسم');
});

test('favourites, cart drawer, promo code, theme toggle, old hash links', async ({ page }) => {
  await page.goto('/products');
  await page.locator('.card[data-id="awal"] .fav').click();
  await expect(page.locator('#favN')).toHaveText('1');
  await page.goto('/favorites');
  await expect(page.locator('#favgrid .card')).toHaveCount(1);

  await page.locator('#favgrid .card .buy').click();
  await page.locator('#navCart').click();
  await expect(page.locator('#drawer')).toHaveClass(/open/);
  await page.locator('#drawer .promo input').fill('wasmi10');
  await page.locator('#drawer .promo button').click();
  await expect(page.locator('#drawer .ln.sv')).toContainText('0.950 د.ك');
  await page.keyboard.press('Escape');
  await expect(page.locator('#drawer')).not.toHaveClass(/open/);

  await page.locator('#theme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /dark|light/);
  const theme = await page.locator('html').getAttribute('data-theme');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme!);

  await page.goto('/#p-ghaim');
  await expect(page).toHaveURL(/\/products\/ghaim$/);
  await page.goto('/#shop');
  await expect(page).toHaveURL(/\/products$/);
});

test('contact form validates like the original', async ({ page }) => {
  await page.goto('/contact');
  await page.locator('#cForm button[type=submit]').click();
  await expect(page.locator('#cForm .err').first()).toHaveText('اكتب اسمك');
  await page.fill('#cn', 'سارة');
  await page.fill('#ce', 'sara@example.test');
  await page.fill('#cm', 'عندي سؤال عن الشموع');
  await page.locator('#cForm button[type=submit]').click();
  await expect(page.locator('#cnote')).toContainText('وصلتنا رسالتك');
});
