// End-to-end checks: real Chrome (headless) -> production frontend build -> real API -> isolated database.
// Run through ./run.sh, which prepares a fresh car_dealer_e2e database and starts both servers.
import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5180';
const API = process.env.E2E_API_URL ?? 'http://localhost:3100/api';
const SHOTS = process.env.E2E_SCREENSHOT_DIR ?? fileURLToPath(new URL('../docs/screenshots', import.meta.url));
const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? 'admin@e2e.test',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'e2e-admin-pass',
};
const stamp = Date.now();
const BUYER = { email: `buyer-${stamp}@e2e.test`, password: 'buyer-pass-123' };
const OTHER = { email: `other-${stamp}@e2e.test`, password: 'other-pass-123' };

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (error) {
    results.push(['FAIL', name, String(error.message).split('\n')[0]]);
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status, json, text };
}
const login = async (who) => (await api('/auth/login', { method: 'POST', body: who })).json.token;

// ---- Test data (through the API, as an admin) ----
const adminToken = await login(ADMIN);
const make = async (v) => (await api('/vehicles', { method: 'POST', token: adminToken, body: v })).json.vehicle;
const creta = await make({ make: 'Hyundai', model: 'Creta', category: 'SUV', price: 1500000, quantity: 5 });
const swift = await make({ make: 'Maruti Suzuki', model: 'Swift', category: 'Hatchback', price: 800000, quantity: 0 });
const seltos = await make({ make: 'Kia', model: 'Seltos', category: 'SUV', price: 1700000, quantity: 3 });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const desktop = { viewport: { width: 1366, height: 900 }, acceptDownloads: true };

// ---- 1. Register and log in as a new buyer ----
const buyerContext = await browser.newContext(desktop);
const page = await buyerContext.newPage();
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(`${m.text()} @ ${m.location().url}`));

await check('1. register a new account through the UI and land on the inventory', async () => {
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Email').fill(BUYER.email);
  await page.getByLabel('Password', { exact: true }).fill(BUYER.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('article', { name: 'Hyundai Creta' }).waitFor();
  assert(await page.getByText(BUYER.email).isVisible(), 'email not shown in navbar');
});

await check('1b. log out and log back in through the sign-in form', async () => {
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByLabel('Email').fill(BUYER.email);
  await page.getByLabel('Password', { exact: true }).fill(BUYER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('article', { name: 'Hyundai Creta' }).waitFor();
});

// ---- 2. Browse and search ----
await check('2. search by make returns only matching vehicles', async () => {
  await page.getByLabel('Make').fill('hyun');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await page.getByText('1 vehicle', { exact: true }).waitFor();
  assert(await page.getByRole('article').count() === 1, 'expected one card');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByText('3 vehicles', { exact: true }).waitFor();
});

await check('2b. availability filter "Out of stock" shows only the Swift (server-side)', async () => {
  await page.getByLabel('Availability').selectOption('out_of_stock');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await page.getByText('1 vehicle', { exact: true }).waitFor();
  assert(await page.getByRole('article', { name: 'Maruti Suzuki Swift' }).isVisible(), 'Swift not shown');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByText('3 vehicles', { exact: true }).waitFor();
});

await check('2c. inverted price range is explained inline and nothing is searched', async () => {
  await page.getByLabel('Min price').fill('2000000');
  await page.getByLabel('Max price').fill('100');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await page.getByText('Min price must not be more than max price').waitFor();
  await page.getByRole('button', { name: 'Clear filters' }).click();
});

await check('2d. out-of-stock vehicle has Purchase disabled', async () => {
  const button = page.getByRole('article', { name: 'Maruti Suzuki Swift' }).getByRole('button', { name: 'Purchase' });
  assert(await button.isDisabled(), 'Purchase should be disabled at zero stock');
});

// ---- 3. Details, 4. review ----
await check('3. open vehicle details (own URL)', async () => {
  await page.getByRole('button', { name: 'View details for Hyundai Creta' }).click();
  await page.getByRole('region', { name: 'Vehicle details' }).waitFor();
  assert(page.url().endsWith(`#vehicle/${creta.id}`), `unexpected URL ${page.url()}`);
  await page.getByText('No reviews yet. Be the first to review this vehicle.').waitFor();
});

await check('4. submit a review; it is stored and the summary updates', async () => {
  const form = page.getByRole('form', { name: 'Write a review' });
  await form.getByRole('button', { name: 'Submit review' }).click();
  await form.getByText('Choose a rating from 1 to 5 stars').waitFor();
  await form.locator('label').nth(4).click(); // the fifth star
  await form.getByLabel('Your review').fill('Comfortable, quiet cabin and a smooth automatic.');
  await form.getByRole('button', { name: 'Submit review' }).click();
  await page.getByText('Thanks! Your review was posted.').waitFor();
  await page.getByText('5 out of 5 · 1 review').waitFor();
  const stored = await api(`/vehicles/${creta.id}/reviews`, { token: adminToken });
  assert(stored.json.summary.averageRating === 5 && stored.json.reviews.length === 1, JSON.stringify(stored.json.summary));
  assert(!stored.text.includes(BUYER.email), 'full email leaked in reviews API');
});

await check('4b. the form is gone after reviewing and a second review is refused by the API', async () => {
  await page.getByText("You've reviewed this vehicle.").waitFor();
  const token = await login(BUYER);
  const again = await api(`/vehicles/${creta.id}/reviews`, { method: 'POST', token, body: { rating: 1, comment: 'again' } });
  assert(again.status === 409, `expected 409, got ${again.status}`);
});
await page.evaluate(() => window.scrollTo(0, 0)); // keep the fixed navbar at the top of the full-page capture
await page.screenshot({ path: `${SHOTS}/reviews.png`, fullPage: true });

// ---- 5. Purchase, 6. stock decreases ----
let invoiceNumber;
await check('5. buy 2 units from the details page and see the order confirmation', async () => {
  const details = page.getByRole('region', { name: 'Vehicle details' });
  await details.getByLabel('Quantity').fill('2');
  await details.getByText('Total: ₹30,00,000').waitFor();
  await details.getByRole('button', { name: 'Purchase' }).click();
  const status = page.getByRole('status').filter({ hasText: 'You purchased' });
  await status.waitFor();
  const text = await status.textContent();
  invoiceNumber = text.match(/INV-\d{6}/)?.[0];
  assert(text.includes('2 × Hyundai Creta') && invoiceNumber, text);
});

await check('6. inventory decreased by 2 in the UI and in the database', async () => {
  await page.getByRole('region', { name: 'Vehicle details' }).getByText('3 in stock').waitFor();
  const list = await api('/vehicles', { token: adminToken });
  assert(list.json.vehicles.find((v) => v.id === creta.id).quantity === 3, 'stock not 3 in API');
});

await check('6b. asking for more than the stock is blocked in the UI and refused by the API', async () => {
  const details = page.getByRole('region', { name: 'Vehicle details' });
  await details.getByLabel('Quantity').fill('4');
  await details.getByText('Only 3 in stock').waitFor();
  assert(await details.getByRole('button', { name: 'Purchase' }).isDisabled(), 'Purchase enabled for too many');
  const token = await login(BUYER);
  const tooMany = await api(`/vehicles/${creta.id}/purchase`, { method: 'POST', token, body: { quantity: 4, unitPrice: 1 } });
  assert(tooMany.status === 409 && tooMany.json.error === 'Only 3 units in stock', JSON.stringify(tooMany.json));
  await details.getByLabel('Quantity').fill('1');
});

// ---- 7. Purchase history and invoice ----
await check('7. purchase history lists the order with its details', async () => {
  await page.getByRole('link', { name: 'My orders' }).click();
  const history = page.getByRole('region', { name: 'Purchase history' });
  await history.getByRole('list', { name: 'Orders' }).waitFor();
  const item = history.getByRole('listitem').first();
  for (const text of ['Hyundai Creta', invoiceNumber, '₹15,00,000', '₹30,00,000']) {
    assert(await item.getByText(text, { exact: true }).count() > 0, `missing ${text}`);
  }
  await page.screenshot({ path: `${SHOTS}/orders.png`, fullPage: true });
});

await check('7b. invoice downloads as a text file with the order details', async () => {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: `Download invoice ${invoiceNumber}` }).click();
  const file = await download;
  assert(file.suggestedFilename() === `${invoiceNumber}.txt`, file.suggestedFilename());
  const content = await readFile(await file.path(), 'utf8');
  for (const text of [invoiceNumber, BUYER.email, 'Hyundai Creta (SUV)', 'Quantity:         2', 'INR 15,00,000.00', 'INR 30,00,000.00']) {
    assert(content.includes(text), `invoice missing "${text}"`);
  }
});

// ---- 8. Unauthorized access ----
await check('8. a regular user sees Access denied at #analytics and the API answers 403', async () => {
  await page.goto(`${BASE}/#analytics`);
  await page.getByRole('region', { name: 'Access denied' }).waitFor();
  await page.screenshot({ path: `${SHOTS}/access-denied.png` });
  const token = await login(BUYER);
  assert((await api('/admin/analytics', { token })).status === 403, 'analytics not 403 for user');
  assert((await api('/vehicles', { method: 'POST', token, body: { make: 'X', model: 'Y', category: 'Z', price: 1, quantity: 1 } })).status === 403, 'create not 403');
  assert((await api(`/vehicles/${seltos.id}`, { method: 'DELETE', token })).status === 403, 'delete not 403');
  assert((await api(`/vehicles/${seltos.id}/restock`, { method: 'POST', token, body: { quantity: 1 } })).status === 403, 'restock not 403');
});

await check('8b. missing or forged tokens get 401; another user cannot see the order or invoice (404)', async () => {
  assert((await api('/purchases')).status === 401, 'no token not 401');
  assert((await api('/purchases', { token: 'forged.token.value' })).status === 401, 'forged not 401');
  await api('/auth/register', { method: 'POST', body: OTHER });
  const otherToken = await login(OTHER);
  const orders = (await api('/purchases', { token: await login(BUYER) })).json.purchases;
  assert((await api('/purchases', { token: otherToken })).json.purchases.length === 0, 'other user sees orders');
  assert((await api(`/purchases/${orders[0].id}`, { token: otherToken })).status === 404, 'order visible');
  assert((await api(`/purchases/${orders[0].id}/invoice`, { token: otherToken })).status === 404, 'invoice visible');
  assert((await api(`/purchases/${orders[0].id}/invoice`, { token: adminToken })).status === 404, 'admin sees invoice');
});

// ---- 10. Existing features still work (as the buyer) ----
await check('10. favorites and comparison (with ratings) still work', async () => {
  await page.goto(`${BASE}/#inventory`);
  await page.getByRole('article', { name: 'Hyundai Creta' }).waitFor();
  await page.getByRole('button', { name: 'Add Kia Seltos to favorites' }).click();
  await page.getByRole('button', { name: 'Favorites (1)' }).click();
  assert(await page.getByRole('article').count() === 1, 'favorites view wrong');
  await page.getByRole('button', { name: 'All vehicles' }).click();
  await page.getByRole('button', { name: 'Compare Hyundai Creta' }).click();
  await page.getByRole('button', { name: 'Compare Maruti Suzuki Swift' }).click();
  await page.getByRole('button', { name: 'Compare Kia Seltos' }).click();
  await page.getByRole('region', { name: 'Compare tray' }).getByRole('button', { name: 'Compare vehicles' }).click();
  const table = page.getByRole('table', { name: 'Vehicle comparison' });
  await table.getByText('5 / 5 (1 review)').waitFor();
  assert(await table.getByText('Lowest price').count() === 1, 'lowest price badge missing');
  await page.screenshot({ path: `${SHOTS}/compare-ratings.png` });
  await page.keyboard.press('Escape');
  assert(await page.getByRole('region', { name: 'Compare tray' }).getByRole('button', { name: 'Compare vehicles' }).evaluate((b) => b === document.activeElement), 'focus not returned');
  await page.getByRole('button', { name: 'Clear comparison' }).click();
});

await check('10b. sorting by "Top rated" puts the reviewed Creta first', async () => {
  await page.getByLabel('Sort by').selectOption('rating');
  const first = await page.getByRole('article').first().getAttribute('aria-label');
  assert(first === 'Hyundai Creta', `first was ${first}`);
  await page.screenshot({ path: `${SHOTS}/inventory-ratings.png` });
});

await check('10c. a one-click card purchase still decrements stock by one', async () => {
  await page.getByRole('article', { name: 'Kia Seltos' }).getByRole('button', { name: 'Purchase' }).click();
  await page.getByRole('status').filter({ hasText: 'You purchased a Kia Seltos' }).waitFor();
  await page.getByRole('article', { name: 'Kia Seltos' }).getByText('2 in stock').waitFor();
});

// ---- 9. Admin: manage inventory and view analytics ----
const adminContext = await browser.newContext(desktop);
const admin = await adminContext.newPage();
admin.on('console', (m) => m.type() === 'error' && consoleErrors.push(`admin: ${m.text()} @ ${m.location().url}`));

await check('9. admin signs in and adds a vehicle through the dialog', async () => {
  await admin.goto(BASE);
  await admin.getByLabel('Email').fill(ADMIN.email);
  await admin.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await admin.getByRole('button', { name: 'Sign in' }).click();
  await admin.getByRole('button', { name: 'Add vehicle' }).click();
  const dialog = admin.getByRole('dialog', { name: 'Add vehicle' });
  await dialog.getByLabel('Make').fill('Tata');
  await dialog.getByLabel('Model').fill('Nexon');
  await dialog.getByLabel('Category').fill('SUV');
  await dialog.getByLabel('Price (₹)').fill('1000000');
  await dialog.getByLabel('Quantity').fill('4');
  await dialog.getByRole('button', { name: 'Save vehicle' }).click();
  await admin.getByRole('article', { name: 'Tata Nexon' }).waitFor();
});

await check('9b. admin restocks the out-of-stock Swift', async () => {
  await admin.getByRole('article', { name: 'Maruti Suzuki Swift' }).getByRole('button', { name: 'Restock Maruti Suzuki Swift' }).click();
  const dialog = admin.getByRole('dialog', { name: 'Restock Maruti Suzuki Swift' });
  await dialog.getByLabel('Quantity to add').fill('2');
  await dialog.getByRole('button', { name: 'Restock' }).click();
  await admin.getByRole('article', { name: 'Maruti Suzuki Swift' }).getByText('2 in stock').waitFor();
});

await check('9c. admin delete asks for confirmation; Cancel keeps, Delete removes', async () => {
  await admin.getByRole('button', { name: 'Delete Tata Nexon' }).click();
  await admin.getByRole('dialog', { name: 'Delete vehicle?' }).getByRole('button', { name: 'Cancel' }).click();
  assert(await admin.getByRole('article', { name: 'Tata Nexon' }).isVisible(), 'deleted on cancel');
  await admin.getByRole('button', { name: 'Delete Tata Nexon' }).click();
  await admin.getByRole('dialog', { name: 'Delete vehicle?' }).getByRole('button', { name: 'Delete' }).click();
  await admin.getByRole('article', { name: 'Tata Nexon' }).waitFor({ state: 'detached' });
});

await check('9d. analytics dashboard shows figures from the stored orders', async () => {
  await admin.getByRole('link', { name: 'Analytics' }).click();
  const dash = admin.getByRole('region', { name: 'Sales and inventory analytics' });
  await dash.getByRole('group', { name: 'Revenue' }).waitFor();
  const value = async (name) => (await dash.getByRole('group', { name }).locator('dd').textContent()).trim();
  // Orders: 2 × Creta (30,00,000) + 1 × Seltos (17,00,000).
  assert(await value('Revenue') === '₹47,00,000', `revenue ${await value('Revenue')}`);
  assert(await value('Orders') === '2', `orders ${await value('Orders')}`);
  assert(await value('Units sold') === '3', `units ${await value('Units sold')}`);
  // Stock: Creta 3, Swift 2, Seltos 2.
  assert(await value('Units in stock') === '7', `stock ${await value('Units in stock')}`);
  assert(await value('Out-of-stock models') === '0', 'out of stock');
  await admin.screenshot({ path: `${SHOTS}/analytics.png`, fullPage: true });
});

await check('9e. analytics date filter: a future range has no sales; All time restores', async () => {
  const dash = admin.getByRole('region', { name: 'Sales and inventory analytics' });
  await dash.getByLabel('From').fill('2030-01-01');
  await dash.getByRole('button', { name: 'Apply dates' }).click();
  await dash.getByText('No sales in this period.').waitFor();
  await dash.getByRole('button', { name: 'All time' }).click();
  await dash.getByRole('table', { name: 'Top-selling vehicles' }).waitFor();
});

// ---- Concurrency against the real API ----
await check('concurrency: 6 simultaneous single-unit purchases of 3 units -> exactly 3 succeed', async () => {
  const kona = await make({ make: 'Hyundai', model: 'Kona', category: 'SUV', price: 2400000, quantity: 3 });
  const token = await login(BUYER);
  const statuses = (await Promise.all([...Array(6)].map(() => api(`/vehicles/${kona.id}/purchase`, { method: 'POST', token })))).map((r) => r.status).sort();
  assert(JSON.stringify(statuses) === '[200,200,200,409,409,409]', JSON.stringify(statuses));
  const after = (await api('/vehicles', { token })).json.vehicles.find((v) => v.id === kona.id);
  assert(after.quantity === 0, `stock ${after.quantity}`);
  await api(`/vehicles/${kona.id}`, { method: 'DELETE', token: adminToken });
});

// ---- Responsive layout ----
for (const [label, width] of [['phone', 390], ['tablet', 820]]) {
  await check(`responsive: no horizontal scrolling on ${label} (${width}px) for inventory, orders and analytics`, async () => {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const p = await context.newPage();
    await p.goto(BASE);
    await p.getByLabel('Email').fill(ADMIN.email);
    await p.getByLabel('Password', { exact: true }).fill(ADMIN.password);
    await p.getByRole('button', { name: 'Sign in' }).click();
    await p.getByRole('article', { name: 'Hyundai Creta' }).waitFor();
    for (const hash of ['#inventory', '#orders', '#analytics']) {
      await p.goto(`${BASE}/${hash}`);
      await p.waitForTimeout(400);
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert(overflow <= 0, `${hash} overflows by ${overflow}px`);
      assert(await p.getByRole('link', { name: 'My orders' }).isVisible(), `nav link hidden on ${hash}`);
    }
    if (width === 390) {
      await p.goto(`${BASE}/#inventory`);
      await p.getByRole('article', { name: 'Hyundai Creta' }).waitFor();
      await p.screenshot({ path: `${SHOTS}/mobile-filters.png` });
      await p.goto(`${BASE}/#analytics`);
      await p.getByRole('group', { name: 'Revenue' }).waitFor();
      await p.screenshot({ path: `${SHOTS}/mobile-analytics.png`, fullPage: true });
    }
    await context.close();
  });
}

await check('no console errors in the browser', async () => {
  assert(consoleErrors.length === 0, consoleErrors.join(' | '));
});

await browser.close();
for (const [status, name, detail] of results) console.log(`${status}  ${name}${detail ? `  -> ${detail}` : ''}`);
const failed = results.filter(([s]) => s === 'FAIL').length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
