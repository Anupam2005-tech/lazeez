const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const cartController = require('../controllers/cartController');

router.use((req, res, next) => {
  if (!req.session.cart) req.session.cart = [];
  next();
});

router.get('/api/state', cartController.apiState);
router.get('/', requireAuth, cartController.showCart);
router.post('/add', cartController.addItem);
router.post('/remove', cartController.removeItem);
router.post('/update', cartController.updateItem);

module.exports = router;
