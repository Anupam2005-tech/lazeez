const db = require('../config/db');
const realtime = require('../services/realtime');
const emailService = require('../services/email');

// Show all orders for the logged-in user
async function listOrders(req, res) {
  try {
    const orders = await db.order.findMany({
      where: { userId: req.session.user.id },
      include: {
        items: { include: { menuItem: true } },
        feedback: { where: { userId: req.session.user.id } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.render('storefront/orders', {
      title: 'My Orders',
      orders
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading orders');
  }
}

// Show single order detail
async function showOrder(req, res) {
  try {
    const orderId = req.params.id;
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { menuItem: true } },
        feedback: { where: { userId: req.session.user.id } }
      }
    });

    if (!order || order.userId !== req.session.user.id) {
      return res.redirect('/orders');
    }

    // Decrypt sensitive data for display
    const encryption = require('../utils/encryption');
    if (order.customerPhone) {
      try {
        order.customerPhone = encryption.decrypt(order.customerPhone);
      } catch (e) {
        // Fallback to raw value if decryption fails (e.g. for old plain text data)
      }
    }

    res.render('storefront/order-detail', {
      title: `Order #${order.id}`,
      order
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading order');
  }
}

// Submit feedback for an order
async function submitFeedback(req, res) {
  try {
    const orderId = req.params.id;
    const { foodRating, storeRating, comment } = req.body;

    // Validate order belongs to user and is delivered
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { feedback: { where: { userId: req.session.user.id } } }
    });

    if (!order || order.userId !== req.session.user.id) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    if (order.status !== 'Delivered') {
      return res.status(400).json({ success: false, error: 'Can only review delivered orders' });
    }

    if (order.status === 'Cancelled') {
      return res.status(400).json({ success: false, error: 'Cannot review cancelled orders' });
    }

    if (order.feedback.length > 0) {
      return res.status(400).json({ success: false, error: 'Already submitted feedback' });
    }

    // Create feedback
    await db.feedback.create({
      data: {
        orderId,
        userId: req.session.user.id,
        foodRating: parseInt(foodRating, 10),
        storeRating: parseInt(storeRating, 10),
        comment: comment || null
      }
    });

    res.json({ success: true, message: 'Feedback submitted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to submit feedback' });
  }
}

// Cancel an order (user-side)
async function cancelOrder(req, res) {
  try {
    const orderId = req.params.id;
    const order = await db.order.findUnique({ where: { id: orderId } });

    if (!order || order.userId !== req.session.user.id) {
      return res.status(403).json({ success: false, error: 'Order not found' });
    }

    if (order.status === 'Delivered') {
      return res.status(400).json({ success: false, error: 'Cannot cancel a delivered order' });
    }

    if (order.status === 'Cancelled') {
      return res.status(400).json({ success: false, error: 'Order is already cancelled' });
    }

    if (!['Pending', 'Preparing'].includes(order.status)) {
      return res.status(400).json({ success: false, error: 'Order cannot be cancelled at this stage' });
    }

    // Set refund status for online paid orders
    const refundData = {};
    if (order.paymentMethod === 'Online' && order.paymentStatus === 'Paid') {
      refundData.refundStatus = 'Pending';
    }

    await db.order.update({
      where: { id: orderId },
      data: {
        status: 'Cancelled',
        cancelReason: 'Cancelled by customer',
        ...refundData
      }
    });

    // Broadcast cancel event in real-time
    realtime.broadcastOrderEvent('order:cancel', {
      orderId: orderId,
      userId: order.userId,
      status: 'Cancelled',
      cancelReason: 'Cancelled by customer'
    });

    // Send cancellation emails (fire-and-forget)
    const fullOrder = await db.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { menuItem: true } } }
    });
    const user = await db.user.findUnique({ where: { id: order.userId } });
    if (fullOrder && user) {
      emailService.sendOrderCancelled(user, fullOrder, 'Cancelled by customer', 'customer');
      // Notify admin
      const admins = await db.user.findMany({ where: { role: 'admin' }, select: { email: true } });
      for (const admin of admins) {
        emailService.sendAdminOrderCancelled(admin.email, fullOrder, user);
      }
    }

    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to cancel order' });
  }
}

// Response Partialing: lightweight JSON endpoint for order status updates
async function apiOrderStatus(req, res) {
  try {
    const orderId = req.params.id;
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        status: true,
        cancelReason: true,
        refundStatus: true,
        feedback: {
          where: { userId: req.session.user.id },
          select: { id: true }
        }
      }
    });

    if (!order || order.userId !== req.session.user.id) {
      return res.status(403).json({ error: 'Not found' });
    }

    res.json({
      id: order.id,
      status: order.status,
      cancelReason: order.cancelReason,
      refundStatus: order.refundStatus,
      hasFeedback: order.feedback.length > 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
}

// Response Partialing: lightweight JSON for orders list page
async function apiOrdersList(req, res) {
  try {
    const orders = await db.order.findMany({
      where: { userId: req.session.user.id },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        paymentMethod: true,
        createdAt: true,
        items: {
          select: {
            quantity: true,
            menuItem: { select: { name: true } }
          }
        },
        feedback: {
          where: { userId: req.session.user.id },
          select: { id: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const result = orders.map(o => ({
      id: o.id,
      status: o.status,
      totalAmount: o.totalAmount,
      paymentMethod: o.paymentMethod,
      createdAt: o.createdAt,
      itemsSummary: o.items.map(i => (i.menuItem ? i.menuItem.name : 'Item') + ' x' + i.quantity).join(', '),
      hasFeedback: o.feedback.length > 0
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
}

module.exports = { listOrders, showOrder, submitFeedback, cancelOrder, apiOrderStatus, apiOrdersList };
