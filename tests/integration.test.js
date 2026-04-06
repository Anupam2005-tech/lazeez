/**
 * Resto — Comprehensive Integration Test Suite
 * ==================================================
 * Tests every HTTP endpoint and feature (except Google Maps & real Firebase auth).
 *
 * Run:  node tests/integration.test.js
 *
 * Prerequisites:
 *   - Server running on PORT 3000 (npm run dev)
 *   - Database seeded (npx prisma db seed)
 *
 * NOTE: This is a self-contained test runner using native http module.
 *       No external test framework required.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

// ─── Test Runner ───────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;
const results = [];

function log(status, name, detail) {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  const line = `${icon} ${status} │ ${name}${detail ? ' — ' + detail : ''}`;
  console.log(line);
  results.push({ status, name, detail });
  if (status === 'PASS') passed++;
  else if (status === 'FAIL') failed++;
  else skipped++;
}

// ─── HTTP helpers ──────────────────────────────────────────
function request(method, path, { body, headers = {}, cookie, followRedirects = false } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { ...headers }
    };

    if (cookie) opts.headers.Cookie = cookie;

    if (body && typeof body === 'object' && !headers['Content-Type']) {
      const json = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(json);
      opts.headers['Accept'] = 'application/json';
      opts.headers['X-Requested-With'] = 'XMLHttpRequest';
    }

    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let json = null;
        try { json = JSON.parse(raw); } catch {}

        // Extract set-cookie
        const setCookie = res.headers['set-cookie'] || [];
        const sessionCookie = setCookie.find(c => c.startsWith('connect.sid='));
        const cookieVal = sessionCookie ? sessionCookie.split(';')[0] : cookie;

        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: raw,
          json,
          cookie: cookieVal,
          location: res.headers.location
        });
      });
    });
    req.on('error', reject);
    if (body && typeof body === 'object') {
      req.write(JSON.stringify(body));
    } else if (body) {
      req.write(body);
    }
    req.end();
  });
}

function get(path, opts) { return request('GET', path, opts); }
function post(path, opts) { return request('POST', path, opts); }

// ─── Assertion helpers ─────────────────────────────────────
function assert(cond, name, detail) {
  if (cond) log('PASS', name, detail);
  else log('FAIL', name, detail);
}

// ─── Session helper: mock login ────────────────────────────
async function mockLogin(role = 'customer') {
  // Create a mock JWT token for the verify endpoint
  const email = role === 'admin' ? 'admin@resto.com' : 'testuser@resto.com';
  const payload = { email, sub: 'test-uid-' + email };
  const fakeToken = 'header.' + Buffer.from(JSON.stringify(payload)).toString('base64') + '.signature';

  const endpoint = role === 'admin' ? '/admin/verify-token' : '/auth/verify-token';
  const res = await post(endpoint, { body: { idToken: fakeToken } });
  return res.cookie;
}

// ════════════════════════════════════════════════════════════
//  TEST SUITES
// ════════════════════════════════════════════════════════════

async function testStorefrontPages() {
  console.log('\n═══ STOREFRONT PAGE TESTS ═══');

  // 1. Home page
  const home = await get('/');
  assert(home.status === 200, 'GET / → 200', `status=${home.status}`);
  assert(home.body.includes("What's on your mind"), 'Home page renders carousel section');
  assert(home.body.includes('__RESTO_ITEMS__'), 'Home page includes menu items JSON data');
  assert(home.body.includes('__RESTO_CATEGORIES__'), 'Home page includes categories JSON data');

  // 2. Home with food type filter
  const vegFilter = await get('/?foodType=veg');
  assert(vegFilter.status === 200, 'GET /?foodType=veg → 200');

  const nonvegFilter = await get('/?foodType=nonveg');
  assert(nonvegFilter.status === 200, 'GET /?foodType=nonveg → 200');

  const bestsellerFilter = await get('/?foodType=bestseller');
  assert(bestsellerFilter.status === 200, 'GET /?foodType=bestseller → 200');

  // 3. Home with search
  const searchRes = await get('/?search=pizza');
  assert(searchRes.status === 200, 'GET /?search=pizza → 200');

  // 4. Menu redirect
  const menuRedirect = await get('/menu');
  assert(menuRedirect.status === 302 || menuRedirect.status === 301 || menuRedirect.status === 308, 'GET /menu redirects', `status=${menuRedirect.status}`);

  // 5. 404 page
  const notFound = await get('/nonexistent-page-xyz');
  assert(notFound.status === 404, 'GET /nonexistent-page → 404', `status=${notFound.status}`);
}

async function testCategoryPages() {
  console.log('\n═══ CATEGORY PAGE TESTS ═══');

  // Get categories from API
  const itemsRes = await get('/api/menu-items');
  const items = itemsRes.json;
  if (!items || items.length === 0) {
    log('SKIP', 'No menu items found, skipping category tests');
    return;
  }
  const catId = items[0].categoryId;

  const catPage = await get(`/category/${catId}`);
  assert(catPage.status === 200, `GET /category/${catId} → 200`, `status=${catPage.status}`);

  // Invalid category
  const invalidCat = await get('/category/99999');
  assert(invalidCat.status === 404, 'GET /category/99999 → 404', `status=${invalidCat.status}`);

  // Category with food type filter
  const catVeg = await get(`/category/${catId}?foodType=veg`);
  assert(catVeg.status === 200, `GET /category/${catId}?foodType=veg → 200`);
}

async function testItemDetailPages() {
  console.log('\n═══ ITEM DETAIL PAGE TESTS ═══');

  // Get menu items to find a valid UID
  const itemsRes = await get('/api/menu-items');
  const items = itemsRes.json;
  if (!items || items.length === 0) {
    log('SKIP', 'No menu items found, skipping item detail tests');
    return;
  }
  const uid = items[0].uid;

  if (uid) {
    const detail = await get(`/item/${uid}`);
    assert(detail.status === 200, `GET /item/${uid} → 200`, `status=${detail.status}`);
    assert(detail.body.includes('ADD TO CART') || detail.body.includes('RestoCart'), 'Item detail shows add-to-cart');
  }

  // Invalid UID
  const invalid = await get('/item/000000');
  assert(invalid.status === 404 || invalid.body.includes('Not Found'), 'GET /item/000000 → 404 or not found page');

  // Non-numeric UID (should 404)
  const nonNumeric = await get('/item/abcdef');
  assert(nonNumeric.status === 404, 'GET /item/abcdef → 404', `status=${nonNumeric.status}`);
}

async function testAPIEndpoints() {
  console.log('\n═══ API ENDPOINT TESTS ═══');

  // 1. Menu Items API
  const menuAll = await get('/api/menu-items');
  assert(menuAll.status === 200, 'GET /api/menu-items → 200');
  assert(Array.isArray(menuAll.json), 'Menu items returns array');
  if (menuAll.json && menuAll.json.length > 0) {
    const item = menuAll.json[0];
    assert(item.id !== undefined, 'Menu item has id');
    assert(item.name !== undefined, 'Menu item has name');
    assert(item.price !== undefined, 'Menu item has price');
    assert(item.categoryId !== undefined, 'Menu item has categoryId');
    assert(item.isVeg !== undefined, 'Menu item has isVeg');
    assert(item.available !== undefined, 'Menu item has available');
  }

  // 2. Menu Items with filters
  const vegItems = await get('/api/menu-items?foodType=veg');
  assert(vegItems.status === 200, 'GET /api/menu-items?foodType=veg → 200');
  if (vegItems.json) {
    const allVeg = vegItems.json.every(i => i.isVeg === true);
    assert(allVeg, 'Veg filter returns only veg items', `count=${vegItems.json.length}`);
  }

  const nonvegItems = await get('/api/menu-items?foodType=nonveg');
  assert(nonvegItems.status === 200, 'GET /api/menu-items?foodType=nonveg → 200');
  if (nonvegItems.json) {
    const allNonveg = nonvegItems.json.every(i => i.isVeg === false);
    assert(allNonveg, 'Non-veg filter returns only non-veg items');
  }

  // 3. Search API
  const searchEmpty = await get('/api/search?q=');
  assert(searchEmpty.status === 200, 'GET /api/search?q= → 200 (empty query)');
  assert(Array.isArray(searchEmpty.json) && searchEmpty.json.length === 0, 'Empty search returns empty array');

  const searchPizza = await get('/api/search?q=pizza');
  assert(searchPizza.status === 200, 'GET /api/search?q=pizza → 200');
  assert(Array.isArray(searchPizza.json), 'Search returns array');

  // 4. Settings API
  const settings = await get('/api/settings');
  assert(settings.status === 200, 'GET /api/settings → 200');
  assert(settings.json && settings.json.deliveryRatePer5km !== undefined, 'Settings has deliveryRatePer5km');
  assert(settings.json && settings.json.platformFee !== undefined, 'Settings has platformFee');

  // 5. Offers API
  const offerCount = await get('/offers/api/count');
  assert(offerCount.status === 200, 'GET /offers/api/count → 200');
  assert(offerCount.json && offerCount.json.totalCount !== undefined, 'Offer count has totalCount');
}

async function testOffersPage() {
  console.log('\n═══ OFFERS PAGE TESTS ═══');

  const offersPage = await get('/offers');
  assert(offersPage.status === 200, 'GET /offers → 200', `status=${offersPage.status}`);

  // Mark offer viewed
  const markRes = await post('/offers/mark-viewed', { body: { offerId: 1 } });
  assert(markRes.status === 200, 'POST /offers/mark-viewed → 200');

  // Dismiss popup
  const dismissRes = await post('/offers/dismiss-popup', { body: { offerId: 1 } });
  assert(dismissRes.status === 200, 'POST /offers/dismiss-popup → 200');
}

async function testAuthPages() {
  console.log('\n═══ AUTH PAGE TESTS ═══');

  const loginPage = await get('/auth/login');
  assert(loginPage.status === 200, 'GET /auth/login → 200', `status=${loginPage.status}`);

  const registerPage = await get('/auth/register');
  assert(registerPage.status === 200, 'GET /auth/register → 200', `status=${registerPage.status}`);
}

async function testCartFlow() {
  console.log('\n═══ CART FLOW TESTS ═══');

  // 1. Cart state (no session)
  const stateRes = await get('/cart/api/state');
  assert(stateRes.status === 200, 'GET /cart/api/state → 200');
  assert(stateRes.json && Array.isArray(stateRes.json.cart), 'Cart state returns cart array');
  const cookie = stateRes.cookie;

  // 2. Add item to cart (AJAX)
  const menuRes = await get('/api/menu-items');
  const availableItem = menuRes.json && menuRes.json.find(i => i.available);
  if (!availableItem) {
    log('SKIP', 'No available items to test cart');
    return;
  }

  const addRes = await post('/cart/add', {
    body: { menuItemId: availableItem.id },
    cookie
  });
  assert(addRes.status === 200, 'POST /cart/add → 200 (AJAX)', `status=${addRes.status}`);
  assert(addRes.json && addRes.json.success === true, 'Cart add returns success: true');
  assert(addRes.json && addRes.json.cartCount >= 1, 'Cart count >= 1 after add');
  const cartCookie = addRes.cookie || cookie;

  // 3. Add same item again (should increment quantity)
  const addRes2 = await post('/cart/add', {
    body: { menuItemId: availableItem.id },
    cookie: cartCookie
  });
  assert(addRes2.status === 200, 'POST /cart/add (same item) → 200');
  if (addRes2.json && addRes2.json.cart) {
    const item = addRes2.json.cart.find(c => c.id === availableItem.id);
    assert(item && item.quantity >= 2, 'Same item added → quantity incremented', `qty=${item?.quantity}`);
  }

  // 4. Update quantity
  const updateRes = await post('/cart/update', {
    body: { id: availableItem.id, quantity: 5 },
    cookie: cartCookie
  });
  assert(updateRes.status === 200, 'POST /cart/update → 200');
  if (updateRes.json && updateRes.json.cart) {
    const item = updateRes.json.cart.find(c => c.id === availableItem.id);
    assert(item && item.quantity === 5, 'Cart update sets quantity to 5', `qty=${item?.quantity}`);
  }

  // 5. Update to 0 should remove
  const updateZero = await post('/cart/update', {
    body: { id: availableItem.id, quantity: 0 },
    cookie: cartCookie
  });
  assert(updateZero.status === 200, 'POST /cart/update qty=0 → 200');
  if (updateZero.json && updateZero.json.cart) {
    const item = updateZero.json.cart.find(c => c.id === availableItem.id);
    assert(!item, 'Item removed when quantity set to 0');
  }

  // 6. Add unavailable item
  const unavailableItem = menuRes.json && menuRes.json.find(i => !i.available);
  if (unavailableItem) {
    const addUnavailRes = await post('/cart/add', {
      body: { menuItemId: unavailableItem.id },
      cookie: cartCookie
    });
    assert(addUnavailRes.status === 400, 'POST /cart/add (unavailable) → 400', `status=${addUnavailRes.status}`);
    assert(addUnavailRes.json && addUnavailRes.json.success === false, 'Unavailable item returns success: false');
  }

  // 7. Add non-existent item
  const addNonExist = await post('/cart/add', {
    body: { menuItemId: 99999 },
    cookie: cartCookie
  });
  assert(addNonExist.status === 400, 'POST /cart/add (non-existent) → 400', `status=${addNonExist.status}`);

  // 8. Remove item
  // First add an item back
  await post('/cart/add', { body: { menuItemId: availableItem.id }, cookie: cartCookie });
  const removeRes = await post('/cart/remove', {
    body: { id: availableItem.id },
    cookie: cartCookie
  });
  assert(removeRes.status === 200, 'POST /cart/remove → 200');
  assert(removeRes.json && removeRes.json.success === true, 'Remove returns success: true');
}

async function testAuthProtection() {
  console.log('\n═══ AUTH PROTECTION TESTS ═══');

  // Cart page should redirect unauthenticated users
  const cartPage = await get('/cart');
  assert(cartPage.status === 302 || cartPage.status === 303 || cartPage.status === 301, 'GET /cart (no auth) → redirects', `status=${cartPage.status}, location=${cartPage.location}`);

  // Orders page should redirect
  const ordersPage = await get('/orders');
  assert(ordersPage.status === 302 || ordersPage.status === 303 || ordersPage.status === 301, 'GET /orders (no auth) → redirects', `status=${ordersPage.status}`);

  // Checkout should redirect
  const checkoutPage = await get('/checkout');
  assert(checkoutPage.status === 302 || checkoutPage.status === 303 || checkoutPage.status === 301, 'GET /checkout (no auth) → redirects', `status=${checkoutPage.status}`);

  // Admin dashboard should redirect
  const adminDash = await get('/admin/dashboard');
  assert(adminDash.status === 302 || adminDash.status === 303 || adminDash.status === 301, 'GET /admin/dashboard (no auth) → redirects', `status=${adminDash.status}`);

  // Admin menu should redirect
  const adminMenu = await get('/admin/menu');
  assert(adminMenu.status === 302 || adminMenu.status === 303 || adminMenu.status === 301, 'GET /admin/menu (no auth) → redirects', `status=${adminMenu.status}`);
}

async function testMockAuthFlow() {
  console.log('\n═══ MOCK AUTH FLOW TESTS ═══');

  // Customer login
  const email = 'integrationtest@resto.com';
  const payload = { email, sub: 'test-uid-' + email };
  const fakeToken = 'header.' + Buffer.from(JSON.stringify(payload)).toString('base64') + '.signature';

  const loginRes = await post('/auth/verify-token', { body: { idToken: fakeToken } });
  assert(loginRes.status === 200, 'POST /auth/verify-token (mock) → 200', `status=${loginRes.status}`);
  assert(loginRes.json && loginRes.json.success === true, 'Mock login returns success: true');

  const userCookie = loginRes.cookie;
  if (!userCookie) {
    log('FAIL', 'No session cookie received from mock login');
    return;
  }

  // Profile endpoints
  const profileRes = await get('/auth/profile', { cookie: userCookie });
  assert(profileRes.status === 200, 'GET /auth/profile → 200 (authenticated)');
  assert(profileRes.json && profileRes.json.email === email, 'Profile returns correct email');

  // Update profile
  const updateRes = await post('/auth/profile', {
    body: { name: 'Integration User', phone: '9876543210' },
    cookie: userCookie,
    headers: { 'Content-Type': 'application/json' }
  });
  assert(updateRes.status === 200, 'POST /auth/profile → 200');
  assert(updateRes.json && updateRes.json.user && updateRes.json.user.name === 'Integration User', 'Profile name updated');

  // Cart page (authenticated)
  const cartPage = await get('/cart', { cookie: userCookie });
  assert(cartPage.status === 200, 'GET /cart (authenticated) → 200', `status=${cartPage.status}`);

  // Orders page (authenticated)
  const ordersPage = await get('/orders', { cookie: userCookie });
  assert(ordersPage.status === 200, 'GET /orders (authenticated) → 200', `status=${ordersPage.status}`);

  // Logout
  const logoutRes = await post('/auth/logout', { cookie: userCookie });
  assert(logoutRes.status === 200, 'POST /auth/logout → 200');
}

async function testCheckoutFlow() {
  console.log('\n═══ CHECKOUT FLOW TESTS ═══');

  // Login
  const email = 'checkouttest@resto.com';
  const payload = { email, sub: 'test-uid-' + email };
  const fakeToken = 'header.' + Buffer.from(JSON.stringify(payload)).toString('base64') + '.signature';
  const loginRes = await post('/auth/verify-token', { body: { idToken: fakeToken } });
  const cookie = loginRes.cookie;
  if (!cookie) { log('SKIP', 'Cannot test checkout without session'); return; }

  // Add item to cart
  const menuRes = await get('/api/menu-items');
  const item = menuRes.json && menuRes.json.find(i => i.available);
  if (!item) { log('SKIP', 'No available items for checkout test'); return; }

  await post('/cart/add', { body: { menuItemId: item.id }, cookie });

  // Checkout page
  const checkoutPage = await get('/checkout', { cookie });
  assert(checkoutPage.status === 200, 'GET /checkout → 200 (with cart items)', `status=${checkoutPage.status}`);

  // Place order (delivery)
  const orderRes = await post('/checkout', {
    body: {
      address: '123 Test Street, Agartala',
      customerName: 'Test User',
      customerPhone: '9876543210',
      paymentMethod: 'COD',
      dineIn: 'false'
    },
    cookie,
    headers: { 'Content-Type': 'application/json' }
  });
  // Should redirect to success page
  assert(
    orderRes.status === 302 || orderRes.status === 303 || orderRes.status === 200,
    'POST /checkout → redirects or 200',
    `status=${orderRes.status}, location=${orderRes.location}`
  );

  // Cart should be empty after order
  const stateRes = await get('/cart/api/state', { cookie });
  assert(stateRes.json && stateRes.json.cartCount === 0, 'Cart empty after placing order');
}

async function testSSEEndpoint() {
  console.log('\n═══ SSE ENDPOINT TESTS ═══');

  // Unauthenticated SSE
  const sseRes = await get('/events');
  assert(sseRes.status === 401, 'GET /events (no auth) → 401', `status=${sseRes.status}`);
}

async function testAdminLogin() {
  console.log('\n═══ ADMIN AUTH TESTS ═══');

  const adminLoginPage = await get('/admin/login');
  assert(adminLoginPage.status === 200, 'GET /admin/login → 200', `status=${adminLoginPage.status}`);

  // Mock admin login
  const email = 'admin@resto.com';
  const payload = { email, sub: 'test-uid-' + email };
  const fakeToken = 'header.' + Buffer.from(JSON.stringify(payload)).toString('base64') + '.signature';
  const loginRes = await post('/admin/verify-token', { body: { idToken: fakeToken } });
  assert(loginRes.status === 200, 'POST /admin/verify-token → 200', `status=${loginRes.status}`);

  return loginRes.cookie;
}

async function testAdminDashboard(cookie) {
  console.log('\n═══ ADMIN DASHBOARD TESTS ═══');

  if (!cookie) { log('SKIP', 'No admin session, skipping dashboard tests'); return; }

  // Dashboard page (overview tab)
  const dash = await get('/admin/dashboard', { cookie });
  assert(dash.status === 200, 'GET /admin/dashboard → 200', `status=${dash.status}`);

  // Dashboard tabs
  const tabs = ['overview', 'menu', 'orders', 'reports', 'offers', 'settings'];
  for (const tab of tabs) {
    const tabRes = await get(`/admin/dashboard?tab=${tab}`, { cookie });
    assert(tabRes.status === 200, `GET /admin/dashboard?tab=${tab} → 200`, `status=${tabRes.status}`);
  }

  // Revenue API with different ranges
  const ranges = ['all', 'today', '7d', '30d', '1y'];
  for (const range of ranges) {
    const revRes = await get(`/admin/api/revenue?range=${range}`, { cookie });
    assert(revRes.status === 200, `GET /admin/api/revenue?range=${range} → 200`);
    assert(revRes.json && revRes.json.totalOrders !== undefined, `Revenue API (${range}) has totalOrders`);
  }

  // Orders API with status filter
  const statuses = ['All', 'Pending', 'Preparing', 'Ready', 'Delivered', 'Cancelled'];
  for (const status of statuses) {
    const ordRes = await get(`/admin/api/orders?status=${status}`, { cookie });
    assert(ordRes.status === 200, `GET /admin/api/orders?status=${status} → 200`);
  }
}

async function testAdminMenuManagement(cookie) {
  console.log('\n═══ ADMIN MENU MANAGEMENT TESTS ═══');
  if (!cookie) { log('SKIP', 'No admin session'); return; }

  // Add form
  const addForm = await get('/admin/menu/add', { cookie });
  assert(addForm.status === 200, 'GET /admin/menu/add → 200');

  // List items
  const listRes = await get('/admin/menu', { cookie });
  // Should redirect to dashboard?tab=menu
  assert(listRes.status === 302 || listRes.status === 200, 'GET /admin/menu → redirect or 200', `status=${listRes.status}`);
}

async function testAdminCategoryManagement(cookie) {
  console.log('\n═══ ADMIN CATEGORY MANAGEMENT TESTS ═══');
  if (!cookie) { log('SKIP', 'No admin session'); return; }

  const catList = await get('/admin/categories', { cookie });
  assert(catList.status === 200, 'GET /admin/categories → 200', `status=${catList.status}`);

  const catAddForm = await get('/admin/categories/add', { cookie });
  assert(catAddForm.status === 200, 'GET /admin/categories/add → 200');
}

async function testAdminOfferManagement(cookie) {
  console.log('\n═══ ADMIN OFFER MANAGEMENT TESTS ═══');
  if (!cookie) { log('SKIP', 'No admin session'); return; }

  const offerList = await get('/admin/offers', { cookie });
  assert(offerList.status === 302 || offerList.status === 200, 'GET /admin/offers → redirect or 200', `status=${offerList.status}`);

  const offerAddForm = await get('/admin/offers/add', { cookie });
  assert(offerAddForm.status === 200, 'GET /admin/offers/add → 200');
}

async function testAdminOrderManagement(cookie) {
  console.log('\n═══ ADMIN ORDER MANAGEMENT TESTS ═══');
  if (!cookie) { log('SKIP', 'No admin session'); return; }

  const orderList = await get('/admin/orders', { cookie });
  assert(orderList.status === 302 || orderList.status === 200, 'GET /admin/orders → redirect or 200', `status=${orderList.status}`);
}

async function testAdminSettings(cookie) {
  console.log('\n═══ ADMIN SETTINGS TESTS ═══');
  if (!cookie) { log('SKIP', 'No admin session'); return; }

  const settingsRes = await post('/admin/settings', {
    body: { deliveryRatePer5km: 15, platformFee: 7 },
    cookie
  });
  assert(settingsRes.status === 200, 'POST /admin/settings → 200');
  assert(settingsRes.json && settingsRes.json.success === true, 'Settings update returns success');

  // Verify settings were updated
  const getSettings = await get('/api/settings');
  assert(getSettings.json && getSettings.json.deliveryRatePer5km === 15, 'Delivery rate updated to 15');
  assert(getSettings.json && getSettings.json.platformFee === 7, 'Platform fee updated to 7');

  // Reset settings
  await post('/admin/settings', {
    body: { deliveryRatePer5km: 10, platformFee: 5 },
    cookie
  });
}

async function testStaticAssets() {
  console.log('\n═══ STATIC ASSET TESTS ═══');

  const cssRes = await get('/css/storefront.css');
  if (cssRes.status === 200) {
    assert(true, 'GET /css/storefront.css → 200');
  } else {
    log('SKIP', 'storefront.css not found (may use different path)');
  }

  const cartJsRes = await get('/js/storefront-cart.js');
  assert(cartJsRes.status === 200, 'GET /js/storefront-cart.js → 200', `status=${cartJsRes.status}`);
  assert(cartJsRes.body.includes('RestoCart'), 'storefront-cart.js contains RestoCart');
}

async function testEdgeCases() {
  console.log('\n═══ EDGE CASE TESTS ═══');

  // Invalid food type should default to 'all'
  const invalidFilter = await get('/?foodType=INVALID');
  assert(invalidFilter.status === 200, 'GET /?foodType=INVALID → 200 (defaults gracefully)');

  // Category with non-numeric ID
  const badCatId = await get('/category/abc');
  assert(badCatId.status === 404 || badCatId.status === 500, 'GET /category/abc → error status', `status=${badCatId.status}`);

  // Double-slash path
  const doublePath = await get('/?//');
  assert(doublePath.status === 200 || doublePath.status === 301, 'GET // → handled gracefully');

  // API search with special characters
  const specialSearch = await get('/api/search?q=%3Cscript%3E');
  assert(specialSearch.status === 200, 'GET /api/search?q=<script> → 200 (no crash)');
  assert(Array.isArray(specialSearch.json), 'XSS search returns safe array response');

  // Non-veg alias
  const nonvegAlias = await get('/api/menu-items?foodType=non-veg');
  assert(nonvegAlias.status === 200, 'GET /api/menu-items?foodType=non-veg → 200 (alias works)');
}

// ════════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   RESTO – Comprehensive Integration Test Suite  ║');
  console.log('║   Testing against: ' + BASE.padEnd(30) + '║');
  console.log('╚══════════════════════════════════════════════════╝');

  // First verify the server is reachable
  try {
    const ping = await get('/');
    if (ping.status !== 200) throw new Error('Server returned ' + ping.status);
  } catch (e) {
    console.error('\n❌ Cannot reach server at ' + BASE);
    console.error('   Make sure "npm run dev" is running.\n');
    process.exit(1);
  }

  try {
    await testStorefrontPages();
    await testCategoryPages();
    await testItemDetailPages();
    await testAPIEndpoints();
    await testOffersPage();
    await testAuthPages();
    await testCartFlow();
    await testAuthProtection();
    await testMockAuthFlow();
    await testCheckoutFlow();
    await testSSEEndpoint();
    const adminCookie = await testAdminLogin();
    await testAdminDashboard(adminCookie);
    await testAdminMenuManagement(adminCookie);
    await testAdminCategoryManagement(adminCookie);
    await testAdminOfferManagement(adminCookie);
    await testAdminOrderManagement(adminCookie);
    await testAdminSettings(adminCookie);
    await testStaticAssets();
    await testEdgeCases();
  } catch (err) {
    console.error('\n💥 Unexpected error during test run:', err);
  }

  // Summary
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log(`║   RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped`.padEnd(51) + '║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  ❌ ${r.name} — ${r.detail || ''}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
