const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.use((req, res, next) => {
  if (!req.session.cart) req.session.cart = [];
  next();
});

router.get('/', requireAuth, (req, res, next) => require('../controllers/checkoutController').showCheckout(req, res, next));
router.post('/', requireAuth, (req, res, next) => require('../controllers/checkoutController').createCheckoutSession(req, res, next));
router.get('/success/:id', requireAuth, (req, res, next) => require('../controllers/checkoutController').orderSuccess(req, res, next));

module.exports = router;
