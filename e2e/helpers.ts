import dns from 'node:dns';
import { expect, type Page, type TestInfo } from '@playwright/test';
import mongoose from 'mongoose';

export const PASSWORD = 'Wasmi-e2e-2026!';

export function uniqueEmail(info: TestInfo, tag: string): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `wasmi.e2e.${tag}.${info.project.name}.${Date.now()}.${rnd}@example.test`;
}

export function isMobile(info: TestInfo) {
  return info.project.name === 'mobile';
}

/** The signed-in name is in the nav bar on desktop and inside the menu on phones. */
export async function expectSignedInName(page: Page, info: TestInfo, name: string) {
  if (isMobile(info)) {
    await page.locator('#menuBtn').click();
    await expect(page.getByTestId('mnav-user')).toContainText(name);
    await page.locator('#menuBtn').click();
  } else {
    await expect(page.getByTestId('nav-user')).toContainText(name);
  }
}

export async function signupUI(page: Page, name: string, email: string, next = '') {
  await page.goto('/signup' + (next ? '?next=' + encodeURIComponent(next) : ''));
  await page.fill('#an', name);
  await page.fill('#ae', email);
  await page.fill('#ap', PASSWORD);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/signup')), page.getByTestId('signup-form').locator('button[type=submit]').click()]);
}

export async function loginUI(page: Page, email: string, next = '') {
  await page.goto('/login' + (next ? '?next=' + encodeURIComponent(next) : ''));
  await page.fill('#ae', email);
  await page.fill('#ap', PASSWORD);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login')), page.getByTestId('login-form').locator('button[type=submit]').click()]);
}

export async function logoutUI(page: Page, info: TestInfo) {
  // Logout reloads the page (so the server re-renders the nav); wait for that reload to finish.
  const reloaded = page.waitForEvent('load');
  if (isMobile(info)) {
    await page.locator('#menuBtn').click();
    await page.locator('#mnav .mnav-btn').click();
  } else {
    await page.locator('.acct-out').click();
  }
  await reloaded;
}

/** Direct DB access for checks. This PC's local DNS filter sometimes refuses Atlas SRV lookups → public resolvers. */
export async function connectTestDb() {
  dns.setServers(['1.1.1.1', '8.8.8.8']);
  await mongoose.connect(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 20_000 });
  return mongoose.connection.db!;
}

/** Adds the default size of a product from its page. */
export async function addFromProductPage(page: Page, slug: string) {
  await page.goto('/products/' + slug);
  await page.locator('.buyrow .btn.primary').click();
  await expect(page.locator('#cartN')).toBeVisible();
}

export async function fillCheckout(page: Page) {
  await page.fill('#fn', 'سارة الاختبار');
  await page.fill('#fp', '99887766');
  await page.fill('#fa', 'السالمية');
  await page.fill('#fad', 'قطعة 2، شارع 10، منزل 5');
}

/** Collects console errors and page errors (React hydration errors included). */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}
