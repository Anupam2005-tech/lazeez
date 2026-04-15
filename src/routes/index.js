const express = require('express');
const router = express.Router();
const db = require('../config/db');
const appCache = require('../services/cache');

router.get('/', (req, res, next) => require('../controllers/homeController').index(req, res, next));
router.get('/menu', (req, res, next) => require('../controllers/homeController').menuPage(req, res, next));
router.get('/item/:uid', (req, res, next) => require('../controllers/homeController').itemDetail(req, res, next));
router.get('/category/:id', (req, res, next) => require('../controllers/homeController').categoryPage(req, res, next));
router.get('/api/search', (req, res, next) => require('../controllers/homeController').search(req, res, next));
router.get('/api/menu-items', (req, res, next) => require('../controllers/homeController').apiMenuItems(req, res, next));
router.get('/offers', (req, res, next) => require('../controllers/offerController').showOffers(req, res, next));
router.get('/offers/api/count', (req, res, next) => require('../controllers/offerController').apiCount(req, res, next));
router.post('/offers/mark-viewed', (req, res, next) => require('../controllers/offerController').markViewed(req, res, next));
router.post('/offers/dismiss-popup', (req, res, next) => require('../controllers/offerController').dismissPopup(req, res, next));

// Legal pages
router.get('/terms', (req, res) => {
  res.render('storefront/terms', {
    title: 'Terms & Conditions',
    metaDescription: 'Read the Terms & Conditions for using Lazeez food ordering platform. Learn about our ordering, delivery, cancellation, and refund policies.',
    canonicalUrl: '/terms',
    robots: 'index, follow'
  });
});

router.get('/privacy', (req, res) => {
  res.render('storefront/privacy', {
    title: 'Privacy Policy',
    metaDescription: 'Learn how Lazeez collects, uses, and protects your personal information. Read our comprehensive privacy policy and understand your data rights.',
    canonicalUrl: '/privacy',
    robots: 'index, follow'
  });
});

router.get('/sitemap.xml', async (req, res) => {
  try {
    const sitemap = await appCache.getSitemap();
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    res.send(sitemap);
  } catch (err) {
    console.error('Sitemap error:', err);
    res.status(500).send('Error generating sitemap');
  }
});

router.get('/api/settings', async (req, res) => {
  try {
    const settings = await appCache.getSettings();
    res.json({
      deliveryRatePer5km: parseFloat(settings.deliveryRatePer5km || '10'),
      platformFee: parseFloat(settings.platformFee || '5')
    });
  } catch (e) {
    res.json({ deliveryRatePer5km: 10, platformFee: 5 });
  }
});

module.exports = router;
