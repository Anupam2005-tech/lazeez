const db = require('../../config/db');
const realtime = require('../../services/realtime');
const emailService = require('../../services/email');

async function listOrders(req, res) {
  const { status } = req.query;
  const whereClause = status && status !== 'All' ? { status } : {};

  const orders = await db.order.findMany({
    where: whereClause,
    include: {
      user: true,
      items: { include: { menuItem: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.render('admin/orders/index', {
    title: 'Order Management',
    layout: 'layouts/admin',
    orders,
    currentStatus: status || 'All'
  });
}

async function showOrder(req, res) {
  const order = await db.order.findUnique({
    where: { id: req.params.id },
    include: {
      user: true,
      items: { include: { menuItem: true } }
    }
  });

  if (!order) return res.redirect('/admin/orders');

  // Decrypt sensitive data for admin display
  const encryption = require('../../utils/encryption');
  if (order.customerPhone) {
    try {
      order.customerPhone = encryption.decrypt(order.customerPhone);
    } catch (e) {
      // Fallback
    }
  }

  res.render('admin/orders/detail', { title: 'Order Details', layout: 'layouts/admin', order });
}

async function updateStatus(req, res) {
  try {
    const orderId = req.params.id;
    const { status } = req.body;
    // Batched: return userId and user in the same update query (eliminates N+1)
    const order = await db.order.update({
      where: { id: orderId },
      data: { status },
      select: { userId: true, user: { select: { id: true, email: true, name: true } } }
    });

    // Broadcast status change in real-time
    realtime.broadcastOrderEvent('order:status', {
      orderId,
      userId: order.userId,
      status
    });

    // Send email notification for status changes (fire-and-forget)
    if (['Ready', 'Delivered'].includes(status) && order.user.email) {
      const fullOrder = await db.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { menuItem: true } } }
      });
      if (fullOrder) {
        if (status === 'Delivered') {
          emailService.sendOrderDelivered(order.user, fullOrder);
        } else if (status === 'Ready') {
          emailService.sendOrderStatusUpdate(order.user, fullOrder, status);
        }
      }
    }

    // Return JSON if AJAX, otherwise redirect
    if (req.headers['accept']?.includes('application/json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({ success: true, orderId, status });
    }
    res.redirect(`/admin/orders/${req.params.id}`);
  } catch (e) {
    console.error(e);
    if (req.headers['accept']?.includes('application/json')) {
      return res.status(500).json({ success: false, error: 'Failed to update' });
    }
    res.redirect('/admin/orders');
  }
}

async function cancelOrder(req, res) {
  try {
    const orderId = req.params.id;
    const { cancelReason } = req.body;

    // Check payment status before cancelling
    const existingOrder = await db.order.findUnique({
      where: { id: orderId },
      select: { paymentMethod: true, paymentStatus: true }
    });

    const refundData = {};
    if (existingOrder && existingOrder.paymentMethod === 'Online' && existingOrder.paymentStatus === 'Paid') {
      refundData.refundStatus = 'Pending';
    }

    // Batched: return userId and user in the same update query (eliminates N+1)
    const order = await db.order.update({
      where: { id: orderId },
      data: {
        status: 'Cancelled',
        cancelReason: cancelReason || 'No reason provided',
        ...refundData
      },
      select: { userId: true, user: { select: { id: true, email: true, name: true } } }
    });

    // Broadcast cancel in real-time
    realtime.broadcastOrderEvent('order:cancel', {
      orderId,
      userId: order.userId,
      status: 'Cancelled',
      cancelReason: cancelReason || 'No reason provided'
    });

    // Send cancellation email to user (fire-and-forget)
    if (order.user.email) {
      const fullOrder = await db.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { menuItem: true } } }
      });
      if (fullOrder) {
        emailService.sendOrderCancelled(order.user, fullOrder, cancelReason || 'No reason provided', 'admin');
      }
    }

    if (req.headers['accept']?.includes('application/json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({ success: true, orderId, status: 'Cancelled' });
    }
    res.redirect(`/admin/orders/${req.params.id}`);
  } catch (e) {
    console.error(e);
    if (req.headers['accept']?.includes('application/json')) {
      return res.status(500).json({ success: false, error: 'Failed to cancel' });
    }
    res.redirect('/admin/orders');
  }
}

module.exports = { listOrders, showOrder, updateStatus, cancelOrder };
