const db = require('../config/db');
const realtime = require('../services/realtime');
const emailService = require('../services/email');
const razorpayService = require('../services/razorpay');

const processedWebhooks = new Set();

async function handleWebhook(req, res) {
  let event;

  try {
    event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (err) {
    console.error('Razorpay webhook parse error:', err.message);
    return res.status(400).send('Invalid webhook payload');
  }

  if (processedWebhooks.has(event.id)) {
    return res.json({ received: true });
  }
  processedWebhooks.add(event.id);

  try {
    switch (event.event) {
      case 'payment.captured': {
        const payment = event.payload.payment.entity;
        const orderId = payment.order_id;
        const paymentId = payment.id;
        const amount = payment.amount / 100;

        const existingOrder = await db.order.findFirst({
          where: { razorpayOrderId: orderId }
        });
        if (existingOrder) {
          return res.json({ received: true });
        }

        const notes = payment.notes || {};
        const userId = notes.userId;
        const cartJSON = JSON.parse(notes.cartJSON || '[]');
        const address = notes.address || '';
        const customerName = notes.customerName || '';
        const customerPhone = notes.customerPhone || '';
        const deliveryFee = parseFloat(notes.deliveryFee || '0');
        const platformFee = parseFloat(notes.platformFee || '0');
        const itemTotal = parseFloat(notes.itemTotal || '0');
        const totalAmount = itemTotal + deliveryFee + platformFee;

        const userData = await db.user.findUnique({ where: { id: userId } });
        if (!userData) {
          console.error('User not found for Razorpay payment:', userId);
          return res.status(400).send('User not found');
        }

        const encryption = require('../utils/encryption');

        const order = await db.order.create({
          data: {
            userId,
            status: 'Pending',
            itemTotal,
            deliveryFee,
            platformFee,
            totalAmount,
            address,
            customerName,
            customerPhone: encryption.encrypt(customerPhone || userData.phone || null),
            paymentMethod: 'Online',
            paymentStatus: 'Paid',
            paymentTimestamp: new Date(),
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            dineIn: false,
            items: {
              create: cartJSON.map(item => ({
                menuItemId: item.id,
                quantity: item.quantity,
                unitPrice: item.price
              }))
            }
          }
        });

        realtime.broadcastOrderEvent('order:new', {
          orderId: order.id,
          userId: order.userId,
          totalAmount: order.totalAmount,
          status: order.status,
          customerName: order.customerName,
          dineIn: order.dineIn,
          createdAt: order.createdAt
        });

        db.order.findUnique({
          where: { id: order.id },
          include: { items: { include: { menuItem: true } } }
        }).then(fullOrder => {
          if (fullOrder) {
            emailService.sendOrderConfirmation(userData, fullOrder);
          }
        }).catch(err => console.error('[email] Order confirmation failed:', err));

        break;
      }

      case 'payment.failed': {
        const payment = event.payload.payment.entity;
        console.error('Razorpay payment failed:', payment.id, payment.error_description || payment.error);
        break;
      }

      case 'order.paid': {
        const order = event.payload.order.entity;
        console.log('Order paid notification:', order.id);
        break;
      }

      default:
        console.log(`Unhandled Razorpay event: ${event.event}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Error processing Razorpay webhook:', err);
    res.status(500).send('Webhook processing error');
  }
}

async function handleSuccess(req, res) {
  const orderId = req.params.orderId;

  try {
    if (req.session.user) {
      req.session.cart = [];
      req.session.pendingRazorpayOrder = null;
      req.session.save();
    }

    const order = await db.order.findUnique({
      where: { id: orderId }
    });

    if (order && order.userId === req.session.user?.id) {
      return res.render('storefront/order-success', {
        title: 'Order Successful',
        order
      });
    }

    res.render('storefront/order-success', {
      title: 'Payment Successful',
      order: null,
      message: 'Payment received! Your order is being processed.'
    });
  } catch (err) {
    console.error('Error handling Razorpay success:', err);
    res.redirect('/orders');
  }
}

async function handleCancel(req, res) {
  res.redirect('/checkout');
}

module.exports = { handleWebhook, handleSuccess, handleCancel };
