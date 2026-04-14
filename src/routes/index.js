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
    const siteUrl = process.env.SITE_URL || 'https://lazeez.com';
    const now = new Date().toISOString();

    const categories = await appCache.getCategories();
    const menuItems = await appCache.getMenuItems();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    xml += '  <url>\n';
    xml += '    <loc>' + siteUrl + '/</loc>\n';
    xml += '    <lastmod>' + now + '</lastmod>\n';
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>1.0</priority>\n';
    xml += '  </url>\n';

    xml += '  <url>\n';
    xml += '    <loc>' + siteUrl + '/menu</loc>\n';
    xml += '    <lastmod>' + now + '</lastmod>\n';
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>0.9</priority>\n';
    xml += '  </url>\n';

    xml += '  <url>\n';
    xml += '    <loc>' + siteUrl + '/offers</loc>\n';
    xml += '    <lastmod>' + now + '</lastmod>\n';
    xml += '    <changefreq>weekly</changefreq>\n';
    xml += '    <priority>0.7</priority>\n';
    xml += '  </url>\n';

    xml += '  <url>\n';
    xml += '    <loc>' + siteUrl + '/terms</loc>\n';
    xml += '    <lastmod>' + now + '</lastmod>\n';
    xml += '    <changefreq>monthly</changefreq>\n';
    xml += '    <priority>0.4</priority>\n';
    xml += '  </url>\n';

    xml += '  <url>\n';
    xml += '    <loc>' + siteUrl + '/privacy</loc>\n';
    xml += '    <lastmod>' + now + '</lastmod>\n';
    xml += '    <changefreq>monthly</changefreq>\n';
    xml += '    <priority>0.4</priority>\n';
    xml += '  </url>\n';
    categories.forEach(function(cat) {
      xml += '  <url>\n';
      xml += '    <loc>' + siteUrl + '/category/' + cat.id + '</loc>\n';
      xml += '    <lastmod>' + now + '</lastmod>\n';
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    });

    menuItems.forEach(function(item) {
      if (item.available) {
        xml += '  <url>\n';
        xml += '    <loc>' + siteUrl + '/item/' + item.uid + '</loc>\n';
        xml += '    <lastmod>' + now + '</lastmod>\n';
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.7</priority>\n';
        xml += '  </url>\n';
      }
    });

    xml += '</urlset>';

    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error('Sitemap error:', err);
    res.status(500).send('Error generating sitemap');
  }
});

router.get('/api/settings', async (req, res) => {
  try {
    const settings = await db.setting.findMany();
    const result = {};
    settings.forEach(s => { result[s.key] = s.value; });
    res.json({
      deliveryRatePer5km: parseFloat(result.deliveryRatePer5km || '10'),
      platformFee: parseFloat(result.platformFee || '5')
    });
  } catch (e) {
    res.json({ deliveryRatePer5km: 10, platformFee: 5 });
  }
});

module.exports = router;
