import { test, expect } from '@playwright/test';

test('auth -> wallet -> trade -> refresh (mocked backend)', async ({ page }) => {
  const API_PREFIX = '/api/v1';

  // Mutable in-test state for mocked backend
  let walletCreated = false;
  const nowIso = new Date().toISOString();
  let walletData = {
    wallet: { id: 1, user_id: 1, balance: 10000.0, currency: 'USD', created_at: nowIso },
    positions: [],
    recent_orders: [],
  } as any;

  // Mock auth/login
  await page.route(`**${API_PREFIX}/auth/login`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access_token: 'test-atk', refresh_token: 'test-rtk', token_type: 'bearer' }),
    });
  });

  // Mock users/me
  await page.route(`**${API_PREFIX}/users/me`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, username: 'testuser', email: 'test@example.com', is_active: true }),
    });
  });

  // Mock GET /wallet
  await page.route(`**${API_PREFIX}/wallet`, async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      if (!walletCreated) {
        return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(walletData) });
    }

    // POST handled below
    return route.continue();
  });

  // Mock POST /wallet (create)
  await page.route(`**${API_PREFIX}/wallet`, async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      walletCreated = true;
      const created = { id: 1, user_id: 1, balance: 10000.0, currency: 'USD', created_at: new Date().toISOString() };
      walletData.wallet = created;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
    }
    return route.continue();
  });

  // Mock POST /wallet/orders
  await page.route(`**${API_PREFIX}/wallet/orders`, async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      const body = await req.postDataJSON();
      const order = {
        id: Math.floor(Math.random() * 100000),
        wallet_id: 1,
        asset_symbol: body.asset_symbol,
        order_type: body.order_type,
        side: body.side,
        price: body.price ?? null,
        quantity: body.quantity,
        status: 'EXECUTED',
        created_at: new Date().toISOString(),
      } as any;

      // update mocked wallet state
      walletData.recent_orders.unshift(order);
      if (body.side === 'BUY' && body.price) {
        const deduction = Number((body.price * body.quantity).toFixed(2));
        walletData.wallet.balance = Number((walletData.wallet.balance - deduction).toFixed(2));
        walletData.positions.push({ id: 1, wallet_id: 1, asset_symbol: body.asset_symbol, quantity: body.quantity, average_entry_price: body.price, updated_at: new Date().toISOString() });
      }

      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(order) });
    }
    return route.continue();
  });

  // Start app
  await page.goto('/');

  // Fill login form (AuthScreen)
  await page.fill('input#login-username', 'testuser');
  await page.fill('input#login-password', 'password123');

  // Submit and wait for auth call
  await Promise.all([
    page.waitForResponse((r) => r.url().includes(`${API_PREFIX}/auth/login`) && r.status() === 200),
    page.click('button:has-text("Sign In")'),
  ]);

  // Expect username shown in nav
  await expect(page.locator('text=testuser')).toBeVisible();

  // Navigate to wallet and expect creation flow to occur and show balance
  await page.goto('/wallet');
  await expect(page.locator('text=Available Balance')).toBeVisible();
  await expect(page.locator('text=Wallet #1')).toBeVisible();
  await expect(page.locator('text=$10,000.00')).toBeVisible();

  // Go to dashboard and place a buy order via BuySellCard
  await page.goto('/');
  // set quantity field (look for the first number input that's not price when market order)
  const qtyInput = page.locator('input[type="number"]').first();
  await qtyInput.fill('0.1');

  // Click Buy button (text contains "Buy BTC")
  await Promise.all([
    page.waitForResponse((r) => r.url().includes(`${API_PREFIX}/wallet/orders`) && r.status() === 201),
    page.click('button:has-text("Buy BTC")'),
  ]);

  // After order, visit wallet and expect updated positions and reduced balance
  await page.goto('/wallet');
  await expect(page.locator('text=Positions value')).toBeVisible();
  await expect(page.locator('text=BTC')).toBeVisible();
  await expect(page.locator('text=Net worth')).toBeVisible();
});
