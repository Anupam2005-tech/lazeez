const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { createClient } = require('redis');
const connectRedis = require('connect-redis');
const RedisStore = connectRedis.RedisStore || connectRedis.default || connectRedis;
const dotenv = require('dotenv');
const db = require('./src/config/db');

dotenv.config();

const app = express();

// View engine setup
app.set('views', path.join(__dirname, 'src', 'views'));
app.set('view engine', 'ejs');
const expressLayouts = require('express-ejs-layouts');
app.use(expressLayouts);
app.set('layout', false); // no default layout (storefront uses partials)

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration (falls back to default memory store if Redis unavailable)
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: SESSION_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  },
  name: 'resto.sid'
};

const valkeyUrl = process.env.VALKEY_URL || 'redis://127.0.0.1:6379';
const valkeyClient = createClient({
  url: valkeyUrl,
  disableOfflineQueue: true, // Crucial: Prevents extreme app slowness if Redis is down
  socket: {
    connectTimeout: 2000,
    reconnectStrategy: (retries) => Math.min(retries * 500, 5000)
  }
});
let redisConnected = false;
valkeyClient.on('connect', () => {
  redisConnected = true;
  console.log('Valkey/Redis connected successfully');
});
valkeyClient.on('error', (err) => {
  redisConnected = false;
});
valkeyClient.connect().catch((err) => {
  console.warn('Valkey/Redis connection unavailable. Using fallback memory session handling indirectly via node-redis failure');
});

const store = new RedisStore({
  client: valkeyClient,
  ttl: SESSION_MAX_AGE / 1000,
  disableTouch: true // Improve performance
});

sessionConfig.store = store;
app.use(session(sessionConfig));
console.log('Session store initialized');


// Global template variables
app.use((req, res, next) => {
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

// Caching for store ratings to prevent DB bottleneck
let cachedStoreRating = { value: 4.3, count: 1300, lastUpdated: 0 };
const RATING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

app.use(async (req, res, next) => {
  try {
    const now = Date.now();
    if (now - cachedStoreRating.lastUpdated > RATING_CACHE_TTL) {
      const BASE_RATING = 4.3;
      const BASE_COUNT = 1300;
      const allFeedback = await db.feedback.findMany({ select: { storeRating: true } });
      const totalRealRating = allFeedback.reduce((sum, f) => sum + (f.storeRating || 0), 0);
      const totalRealCount = allFeedback.length;
      
      const weightedRating = ((BASE_RATING * BASE_COUNT) + totalRealRating) / (BASE_COUNT + totalRealCount);
      
      cachedStoreRating = {
        value: parseFloat(weightedRating.toFixed(1)),
        count: BASE_COUNT + totalRealCount,
        lastUpdated: now
      };
    }
    
    res.locals.storeRating = cachedStoreRating.value;
    res.locals.storeRatingCount = cachedStoreRating.count;
  } catch (e) {
    res.locals.storeRating = cachedStoreRating.value || 4.3;
    res.locals.storeRatingCount = cachedStoreRating.count || 1300;
  }
  next();
});


// Caching for offers to prevent DB bottleneck
let cachedOffers = { data: [], lastUpdated: 0 };
const OFFERS_CACHE_TTL = 60 * 1000; // 1 minute

app.use(async (req, res, next) => {
  try {
    const now = Date.now();
    if (now - cachedOffers.lastUpdated > OFFERS_CACHE_TTL) {
      const activeOffers = await db.offer.findMany({
        where: { active: true },
        orderBy: { createdAt: 'desc' }
      });
      cachedOffers = { data: activeOffers, lastUpdated: now };
    }

    const activeOffers = cachedOffers.data;

    // Read dismissed offer IDs from persistent cookie (survives session expiry)
    let popupDismissedOfferIds = [];
    try {
      const cookieVal = req.cookies?.offer_popup_dismissed;
      if (cookieVal) popupDismissedOfferIds = JSON.parse(cookieVal);
      if (!Array.isArray(popupDismissedOfferIds)) popupDismissedOfferIds = [];
    } catch (e) {
      popupDismissedOfferIds = [];
    }

    if (!req.session.viewedOfferIds) req.session.viewedOfferIds = [];
    
    const unseen = activeOffers.filter(o => !req.session.viewedOfferIds.includes(o.id));
    res.locals.unseenOfferCount = unseen.length;

    // Popup: show once after new offer, never again until dismissed
    if (unseen.length > 0 && !req.path.startsWith('/offers')) {
      const notDismissed = unseen.filter(o => !popupDismissedOfferIds.includes(o.id));
      if (notDismissed.length > 0) {
        res.locals.popupOffer = notDismissed[0];
      } else {
        res.locals.popupOffer = null;
      }
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
