const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ordersController = require('../controllers/ordersController');

router.use(requireAuth);

router.get('/', ordersController.listOrders);
router.get('/api/list', ordersController.apiOrdersList);
router.get('/:id', ordersController.showOrder);
router.get('/:id/api/status', ordersController.apiOrderStatus);
router.post('/:id/feedback', ordersController.submitFeedback);
router.post('/:id/cancel', ordersController.cancelOrder);

module.exports = router;
