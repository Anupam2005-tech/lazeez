const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', (req, res, next) => require('../controllers/ordersController').listOrders(req, res, next));
router.get('/api/list', (req, res, next) => require('../controllers/ordersController').apiOrdersList(req, res, next));
router.get('/:id', (req, res, next) => require('../controllers/ordersController').showOrder(req, res, next));
router.get('/:id/api/status', (req, res, next) => require('../controllers/ordersController').apiOrderStatus(req, res, next));
router.post('/:id/feedback', (req, res, next) => require('../controllers/ordersController').submitFeedback(req, res, next));
router.post('/:id/cancel', (req, res, next) => require('../controllers/ordersController').cancelOrder(req, res, next));

module.exports = router;
