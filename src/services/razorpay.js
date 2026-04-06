const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

async function createOrder({ amount, currency, receipt, notes }) {
  return razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: currency || 'INR',
    receipt,
    notes
  });
}

function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const body = orderId + '|' + paymentId;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return expected === signature;
}

async function verifyWebhookSignature(payload, signature) {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  return expected === signature;
}

async function processRefund(paymentId, amount) {
  return razorpay.payments.refund(paymentId, {
    amount: Math.round(amount * 100),
    speed: 'normal'
  });
}

async function fetchPayment(paymentId) {
  return razorpay.payments.fetch(paymentId);
}

module.exports = { createOrder, verifyPaymentSignature, verifyWebhookSignature, processRefund, fetchPayment };
