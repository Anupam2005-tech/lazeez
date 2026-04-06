const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../middleware/adminAuth');
const dashboardController = require('../../controllers/admin/dashboardController');
const db = require('../../config/db');

const menuRoutes = require('./menu');
const orderRoutes = require('./orders');
const reportRoutes = require('./reports');
const offerRoutes = require('./offers');
const categoryRoutes = require('./categories');
const refundRoutes = require('./refunds');

router.use(requireAdmin);

router.get('/menu', (req, res) => res.redirect('/admin/dashboard?tab=menu'));
router.get('/orders', (req, res) => res.redirect('/admin/dashboard?tab=orders'));
router.get('/reports', (req, res) => res.redirect('/admin/dashboard?tab=reports'));
router.get('/offers', (req, res) => res.redirect('/admin/dashboard?tab=offers'));

router.get('/dashboard', dashboardController.showDashboard);
router.get('/api/revenue', dashboardController.apiRevenue);
router.get('/api/orders', dashboardController.apiOrders);

router.post('/settings', async (req, res) => {
  try {
    const { deliveryRatePer5km, platformFee } = req.body;
    if (deliveryRatePer5km !== undefined) {
      await db.setting.upsert({
        where: { key: 'deliveryRatePer5km' },
        update: { value: String(deliveryRatePer5km) },
        create: { key: 'deliveryRatePer5km', value: String(deliveryRatePer5km) }
      });
    }
    if (platformFee !== undefined) {
      await db.setting.upsert({
        where: { key: 'platformFee' },
        update: { value: String(platformFee) },
        create: { key: 'platformFee', value: String(platformFee) }
      });
    }
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

router.use('/menu', menuRoutes);
router.use('/orders', orderRoutes);
router.use('/reports', reportRoutes);
router.use('/offers', offerRoutes);
router.use('/categories', categoryRoutes);
router.use('/refunds', refundRoutes);

module.exports = router;
