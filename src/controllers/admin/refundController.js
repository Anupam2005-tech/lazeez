const db = require('../../config/db');
const emailService = require('../../services/email');

async function listRefunds(req, res) {
  try {
    const refunds = await db.order.findMany({
      where: {
        status: 'Cancelled',
        paymentMethod: 'Online',
        paymentStatus: 'Paid',
        refundStatus: { not: 'Completed' }
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' }
    });

    const completedRefunds = await db.order.findMany({
      where: {
        status: 'Cancelled',
        paymentMethod: 'Online',
        paymentStatus: 'Paid',
        refundStatus: 'Completed'
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
      take: 50
    });

    res.render('admin/refunds/index', {
      title: 'Manage Refunds',
      layout: 'layouts/admin',
      refunds,
      completedRefunds
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading refunds');
  }
}

async function markCompleted(req, res) {
  try {
    const orderId = req.params.id;

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { totalAmount: true, refundStatus: true, user: { select: { email: true, name: true, id: true } } }
    });

    if (!order) {
      if (req.headers['accept']?.includes('application/json')) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      return res.redirect('/admin/refunds');
    }

    if (order.refundStatus === 'Completed') {
      if (req.headers['accept']?.includes('application/json')) {
        return res.json({ success: true, orderId, refundStatus: 'Completed' });
      }
      return res.redirect('/admin/refunds');
    }


    // Fake Refund Simulation
    const refund = { id: 'fake_refund_' + Date.now() };

    await db.order.update({
      where: { id: orderId },
      data: { refundStatus: 'Completed' }
    });

    if (order.user.email) {
      const fullOrder = await db.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { menuItem: true } } }
      });
      if (fullOrder) {
        emailService.sendRefundCompleted(order.user, fullOrder);
      }
    }

    if (req.headers['accept']?.includes('application/json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({ success: true, orderId, refundStatus: 'Completed' });
    }
    res.redirect('/admin/refunds');
  } catch (err) {
    if (req.headers['accept']?.includes('application/json')) {
      return res.status(500).json({ success: false, error: err.message || 'Failed to process fake refund' });
    }
    res.redirect('/admin/refunds');
  }
}

module.exports = { listRefunds, markCompleted };
