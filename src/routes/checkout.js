const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const checkoutController = require('../controllers/checkoutController');

router.use((req, res, next) => {
  if (!req.session.cart) req.session.cart = [];
  next();
});

router.get('/', requireAuth, checkoutController.showCheckout);
router.post('/', requireAuth, checkoutController.createCheckoutSession);
router.get('/success/:id', requireAuth, checkoutController.orderSuccess);

module.exports = router;
