const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');

const dotenv = require('dotenv');
const db = require('./src/config/db');

dotenv.config();

const app = express();
app.set('trust proxy', 1); 

// View engine setup
app.set('views', path.join(__dirname, 'src', 'views'));
app.set('view engine', 'ejs');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Static assets with aggressive caching
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1y',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Don't cache HTML files
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return;
    }
    // Cache-bust JS/CSS by using immutable for hashed files
    if (filePath.match(/\.(js|css)$/) && !filePath.includes('.map')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

// Session configuration (falls back to default memory store if Redis unavailable)
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  rolling: false, // Don't reset maxAge on every request (saves a session write per request)
  cookie: {
    maxAge: SESSION_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  },
  name: 'resto.sid'
};

class UpstashRestStore extends session.Store {
  constructor(options) {
    super(options);
    const apiToken = process.env.KV_REST_API_TOKEN || '';
    if (process.env.KV_REST_API_URL) {
      this.restUrl = process.env.KV_REST_API_URL;
      this.token = apiToken;
    } else {
      const parsed = new URL(options.url || 'redis://127.0.0.1:6379');
      this.restUrl = 'https://' + parsed.hostname;
      this.token = parsed.password || parsed.username || apiToken;
    }
    this.ttl = options.ttl || 86400;
  }
  
  async _request(body) {
    if (!this.token || !this.restUrl) return null;
    try {
      const res = await fetch(this.restUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Upstash KV error: ' + await res.text());
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data.result;
    } catch(e) {
      console.error('Upstash fetch failed:', e.message);
      return null;
    }
  }

  get(sid, cb) {
    this._request(["GET", `sess:${sid}`])
      .then(res => {
        if (!res) return cb(null, null);
        try { cb(null, typeof res === 'string' ? JSON.parse(res) : res); }
        catch(e) { cb(null, null); }
      })
      .catch(err => { cb(null, null); });
  }
  
  set(sid, sessionData, cb) {
    const val = JSON.stringify(sessionData);
    this._request(["SET", `sess:${sid}`, val, "EX", this.ttl])
      .then(() => cb(null))
      .catch(err => cb(err));
  }
  
  destroy(sid, cb) {
    this._request(["DEL", `sess:${sid}`])
      .then(() => cb(null))
      .catch(err => cb(err));
  }
  
  // No-op touch — prevents express-session from re-writing unchanged sessions
  touch(sid, session, cb) {
    cb(null);
  }
}

const isProduction = process.env.NODE_ENV === 'production' || process.env.VALKEY_URL || process.env.KV_REST_API_URL;
const store = isProduction ? new UpstashRestStore({
  url: process.env.VALKEY_URL,
  ttl: Math.floor(SESSION_MAX_AGE / 1000)
}) : new session.MemoryStore();

sessionConfig.store = store;
app.use(session(sessionConfig));
if (process.env.NODE_ENV !== 'production') console.log('Session store initialized');


  // Global template variables
  app.use((req, res, next) => {
    res.locals.routes = {
      home: '/',
      menu: '/menu',
      offers: '/offers',
      cart: '/cart',
      orders: '/orders',
      profile: '/auth/profile'
    };
    res.locals.req = req;
    res.locals.user = req.session.user || null;
  res.locals.cart = req.session.cart || [];
  // Onboarding wizard: show if user just logged in and profile is incomplete
  var u = req.session.user;
  if (u && req.session.showOnboarding && !req.session.onboardingDone) {
    var incomplete = !u.name || !u.phone || !u.email || !u.address;
    res.locals._showOnboarding = incomplete;
  } else {
    res.locals._showOnboarding = false;
  }
  res.locals.restaurantLat = parseFloat(process.env.RESTAURANT_LAT) || 23.5492425;
  res.locals.restaurantLng = parseFloat(process.env.RESTAURANT_LNG) || 91.4668604;
  res.locals.firebaseApiKey = process.env.FIREBASE_API_KEY || '';
  res.locals.firebaseAuthDomain = process.env.FIREBASE_AUTH_DOMAIN || '';
  res.locals.firebaseProjectId = process.env.FIREBASE_PROJECT_ID || '';
  res.locals.firebaseStorageBucket = process.env.FIREBASE_STORAGE_BUCKET || '';
  res.locals.firebaseMessagingSenderId = process.env.FIREBASE_MESSAGING_SENDER_ID || '';
  res.locals.firebaseAppId = process.env.FIREBASE_APP_ID || '';
  res.locals.recaptchaSiteKey = process.env.RECAPTCHA_SITE_KEY || '';
  res.locals.recaptchaV2SiteKey = process.env.RECAPTCHA_V2_SITE_KEY || '';
  next();
});

// Combined data middleware — runs rating + offers queries in PARALLEL, skips non-HTML routes
let cachedStoreRating = { value: 4.3, count: 1300, lastUpdated: 0 };
const RATING_CACHE_TTL = 10 * 60 * 1000; // 10 minutes (was 5 — longer = fewer cold-start DB hits)

let cachedOffers = { data: [], lastUpdated: 0 };
const OFFERS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes (was 1 — much less DB pressure)

app.use(async (req, res, next) => {
  // Skip heavy DB work for routes that don't render HTML templates
  const p = req.path;
  if (p.startsWith('/api') || p.startsWith('/events') || p.startsWith('/favicon') || p.endsWith('.json')) {
    res.locals.storeRating = cachedStoreRating.value;
    res.locals.storeRatingCount = cachedStoreRating.count;
    res.locals.unseenOfferCount = 0;
    res.locals.popupOffer = null;
    return next();
  }

  const now = Date.now();
  const needsRating = now - cachedStoreRating.lastUpdated > RATING_CACHE_TTL;
  const needsOffers = now - cachedOffers.lastUpdated > OFFERS_CACHE_TTL;

  try {
    // Run both DB queries in PARALLEL instead of sequentially
    const [ratingResult, offersResult] = await Promise.all([
      needsRating
        ? db.feedback.findMany({ select: { storeRating: true } }).catch(() => null)
        : Promise.resolve(null),
      needsOffers
        ? db.offer.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } }).catch(() => null)
        : Promise.resolve(null)
    ]);

    // Update rating cache
    if (ratingResult !== null) {
      const BASE_RATING = 4.3, BASE_COUNT = 1300;
      const totalRealRating = ratingResult.reduce((sum, f) => sum + (f.storeRating || 0), 0);
      const totalRealCount = ratingResult.length;
      const weightedRating = ((BASE_RATING * BASE_COUNT) + totalRealRating) / (BASE_COUNT + totalRealCount);
      cachedStoreRating = {
        value: parseFloat(weightedRating.toFixed(1)),
        count: BASE_COUNT + totalRealCount,
        lastUpdated: now
      };
    }

    // Update offers cache
    if (offersResult !== null) {
      cachedOffers = { data: offersResult, lastUpdated: now };
    }
  } catch (e) {
    // Silently use cached values on error
  }

  // Set rating locals
  res.locals.storeRating = cachedStoreRating.value;
  res.locals.storeRatingCount = cachedStoreRating.count;

  // Set offers locals
  try {
    const activeOffers = cachedOffers.data;
    let popupDismissedOfferIds = [];
    try {
      const cookieVal = req.cookies?.offer_popup_dismissed;
      if (cookieVal) popupDismissedOfferIds = JSON.parse(cookieVal);
      if (!Array.isArray(popupDismissedOfferIds)) popupDismissedOfferIds = [];
    } catch (e) { popupDismissedOfferIds = []; }

    if (!req.session.viewedOfferIds) req.session.viewedOfferIds = [];
    const unseen = activeOffers.filter(o => !req.session.viewedOfferIds.includes(o.id));
    res.locals.unseenOfferCount = unseen.length;

    if (unseen.length > 0 && !req.path.startsWith('/offers')) {
      const notDismissed = unseen.filter(o => !popupDismissedOfferIds.includes(o.id));
      res.locals.popupOffer = notDismissed.length > 0 ? notDismissed[0] : null;
    } else {
      res.locals.popupOffer = null;
    }
  } catch (e) {
    res.locals.unseenOfferCount = 0;
    res.locals.popupOffer = null;
  }
  next();
});


// Import Routes
const indexRoutes = require('./src/routes/index');
const authRoutes = require('./src/routes/auth');
const cartRoutes = require('./src/routes/cart');
const checkoutRoutes = require('./src/routes/checkout');
const ordersRoutes = require('./src/routes/orders');
const adminAuthRoutes = require('./src/routes/admin/auth');
const adminRoutes = require('./src/routes/admin/index');
const addressRoutes = require('./src/routes/addresses');
const realtime = require('./src/services/realtime');
const { authLimiter, apiLimiter } = require('./src/middleware/rateLimiter');

// SSE endpoint for real-time events
app.get('/events', (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) {
    res.status(401).end();
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Send initial ping
  res.write('event: connected\ndata: {"ok":true}\n\n');

  // Register client
  if (req.session.user.role === 'admin') {
    realtime.addAdminClient(res);
  } else {
    realtime.addUserClient(userId, res);
  }
});

// Make realtime available to routes
app.locals.realtime = realtime;

// Mount Routes
app.use('/', indexRoutes);
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);
app.use('/auth', authRoutes);
app.use('/api', apiLimiter);
app.use('/cart', cartRoutes);
app.use('/checkout', checkoutRoutes);
app.use('/orders', ordersRoutes);
app.use('/addresses', addressRoutes);
app.use('/admin', adminAuthRoutes);
app.use('/admin', adminRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).render('storefront/404', { title: 'Page Not Found', robots: 'noindex, nofollow' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
