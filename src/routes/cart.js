const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.use((req, res, next) => {
  if (!req.session.cart) req.session.cart = [];
  next();
});

router.get('/api/state', (req, res, next) => require('../controllers/cartController').apiState(req, res, next));
router.get('/', requireAuth, (req, res, next) => require('../controllers/cartController').showCart(req, res, next));
router.post('/add', (req, res, next) => require('../controllers/cartController').addItem(req, res, next));
router.post('/remove', (req, res, next) => require('../controllers/cartController').removeItem(req, res, next));
router.post('/update', (req, res, next) => require('../controllers/cartController').updateItem(req, res, next));

module.exports = router;
