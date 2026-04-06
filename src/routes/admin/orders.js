const express = require('express');
const router = express.Router();
const ordersController = require('../../controllers/admin/ordersController');

const validate = require('../../middleware/validate');
const { updateStatusSchema, cancelOrderSchema } = require('../../schemas/orderSchema');

router.get('/', ordersController.listOrders);
router.get('/:id', ordersController.showOrder);
router.post('/:id/status', validate(updateStatusSchema), ordersController.updateStatus);
router.post('/:id/cancel', validate(cancelOrderSchema), ordersController.cancelOrder);

module.exports = router;
