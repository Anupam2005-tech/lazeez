const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const offerController = require('../controllers/offerController');
const db = require('../config/db');
const appCache = require('../services/cache');

router.get('/', homeController.index);
router.get('/menu', homeController.menuPage);
router.get('/item/:uid', homeController.itemDetail);
router.get('/category/:id', homeController.categoryPage);
router.get('/api/search', homeController.search);
router.get('/api/menu-items', homeController.apiMenuItems);
router.get('/offers', offerController.showOffers);
router.get('/offers/api/count', offerController.apiCount);
router.post('/offers/mark-viewed', offerController.markViewed);
router.post('/offers/dismiss-popup', offerController.dismissPopup);

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
