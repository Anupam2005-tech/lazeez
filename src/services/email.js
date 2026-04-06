const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Different from addresses for different email types
const FROM_ORDERS = process.env.EMAIL_FROM_ORDERS || 'Lazeez Orders <onboarding@resend.dev>';
const FROM_OFFERS = process.env.EMAIL_FROM_OFFERS || 'Lazeez Offers <onboarding@resend.dev>';
const FROM_SUPPORT = process.env.EMAIL_FROM_SUPPORT || 'Lazeez Support <onboarding@resend.dev>';

// ─── Helpers ────────────────────────────────────────────────────────

function formatCurrency(amount) {
  return `\u20B9${Number(amount).toFixed(2)}`;
}

function formatDate(date) {
  return new Date(date).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function orderItemsTable(items) {
  const rows = items.map(item => {
    const name = item.menuItem ? item.menuItem.name : 'Item';
    const total = item.unitPrice * item.quantity;
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#282c3f;font-size:14px;">${name}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:center;color:#7e808c;font-size:14px;">${item.quantity}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:#282c3f;font-size:14px;">${formatCurrency(total)}</td>
      </tr>`;
  }).join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      <thead>
        <tr style="border-bottom:2px solid #fc8019;">
          <th style="padding:10px 0;text-align:left;color:#7e808c;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Item</th>
          <th style="padding:10px 0;text-align:center;color:#7e808c;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
          <th style="padding:10px 0;text-align:right;color:#7e808c;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Price</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function orderSummary(order) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:2px solid #f0f0f0;padding-top:8px;">
      <tr>
        <td style="padding:6px 0;color:#7e808c;font-size:14px;">Item Total</td>
        <td style="padding:6px 0;text-align:right;color:#282c3f;font-size:14px;">${formatCurrency(order.itemTotal)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#7e808c;font-size:14px;">Delivery Fee</td>
        <td style="padding:6px 0;text-align:right;color:#282c3f;font-size:14px;">${formatCurrency(order.deliveryFee)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#7e808c;font-size:14px;">Platform Fee</td>
        <td style="padding:6px 0;text-align:right;color:#282c3f;font-size:14px;">${formatCurrency(order.platformFee)}</td>
      </tr>
      <tr style="border-top:2px solid #282c3f;">
        <td style="padding:10px 0;font-weight:bold;color:#282c3f;font-size:16px;">Total</td>
        <td style="padding:10px 0;text-align:right;font-weight:bold;color:#fc8019;font-size:16px;">${formatCurrency(order.totalAmount)}</td>
      </tr>
    </table>`;
}

function wrapper(content) {
  return `
  <div style="background-color:#f8f8f8;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <div style="background:#fc8019;padding:20px 24px;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Lazeez</h1>
      </div>
      <div style="padding:24px;">
        ${content}
      </div>
      <div style="padding:16px 24px;background:#fafafa;text-align:center;">
        <p style="margin:0;color:#9e9e9e;font-size:12px;">&copy; ${new Date().getFullYear()} Lazeez. All rights reserved.</p>
      </div>
    </div>
  </div>`;
}

// ─── Core Send ──────────────────────────────────────────────────────

async function send({ to, subject, html, from }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set, skipping email');
    return null;
  }
  try {
    const result = await resend.emails.send({ from: from || FROM_ORDERS, to, subject, html });
    console.log(`[email] Sent "${subject}" to ${to} — id: ${result.data?.id || 'ok'}`);
    return result;
  } catch (err) {
    console.error(`[email] Failed to send to ${to}:`, err.message);
    return null;
  }
}

// ─── Public Email Functions ─────────────────────────────────────────

/**
 * Order confirmation — sent after successful checkout
 */
async function sendOrderConfirmation(user, order) {
  if (!user.email) return;

  const itemsHtml = orderItemsTable(order.items);
  const paymentLabel = order.paymentMethod === 'Online' ? 'Online Payment' : 'Cash on Delivery';
  const addressLine = order.dineIn
    ? '<strong style="color:#0e9f6e;">Dine-in</strong>'
    : (order.address || 'N/A');

  const html = wrapper(`
    <h2 style="margin:0 0 8px;color:#282c3f;font-size:20px;">Order Confirmed! </h2>
    <p style="margin:0 0 20px;color:#7e808c;font-size:14px;">Thank you for your order, ${user.name || 'there'}!</p>

    <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#7e808c;font-size:13px;padding:4px 0;">Order ID</td>
          <td style="color:#282c3f;font-size:13px;font-weight:600;text-align:right;padding:4px 0;">#${order.id.slice(0, 8).toUpperCase()}</td>
        </tr>
        <tr>
          <td style="color:#7e808c;font-size:13px;padding:4px 0;">Date</td>
          <td style="color:#282c3f;font-size:13px;text-align:right;padding:4px 0;">${formatDate(order.createdAt)}</td>
        </tr>
        <tr>
          <td style="color:#7e808c;font-size:13px;padding:4px 0;">Payment</td>
          <td style="color:#282c3f;font-size:13px;text-align:right;padding:4px 0;">${paymentLabel}</td>
        </tr>
        <tr>
          <td style="color:#7e808c;font-size:13px;padding:4px 0;vertical-align:top;">${order.dineIn ? 'Type' : 'Address'}</td>
          <td style="color:#282c3f;font-size:13px;text-align:right;padding:4px 0;">${addressLine}</td>
        </tr>
      </table>
    </div>

    <h3 style="margin:0 0 8px;color:#282c3f;font-size:15px;">Your Items</h3>
    ${itemsHtml}
    ${orderSummary(order)}

    <p style="margin:24px 0 0;color:#7e808c;font-size:13px;text-align:center;">We'll notify you when your order status changes.</p>
  `);

  return send({ to: user.email, subject: `Order Confirmed — #${order.id.slice(0, 8).toUpperCase()}`, html, from: FROM_ORDERS });
}

/**
 * Order status update — sent when admin updates status (e.g. Preparing → Ready)
 */
async function sendOrderStatusUpdate(user, order, newStatus) {
  if (!user.email) return;

  const statusColors = {
    'Preparing': '#f59e0b',
    'Ready': '#0e9f6e',
  };
  const color = statusColors[newStatus] || '#7e808c';

  const html = wrapper(`
    <h2 style="margin:0 0 8px;color:#282c3f;font-size:20px;">Order Status Updated</h2>
    <p style="margin:0 0 20px;color:#7e808c;font-size:14px;">Hi ${user.name || 'there'}, your order has been updated.</p>

    <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#7e808c;font-size:13px;padding:4px 0;">Order ID</td>
          <td style="color:#282c3f;font-size:13px;font-weight:600;text-align:right;padding:4px 0;">#${order.id.slice(0, 8).toUpperCase()}</td>
        </tr>
        <tr>
          <td style="color:#7e808c;font-size:13px;padding:4px 0;">Status</td>
          <td style="text-align:right;padding:4px 0;">
            <span style="display:inline-block;background:${color};color:#fff;padding:4px 14px;border-radius:20px;font-size:13px;font-weight:600;">${newStatus}</span>
          </td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 24px;color:#7e808c;font-size:13px;">${newStatus === 'Ready' ? 'Your order is ready! It will be on its way soon.' : 'Your order is being prepared with care.'}</p>
  `);

  return send({ to: user.email, subject: `Order ${newStatus} — #${order.id.slice(0, 8).toUpperCase()}`, html, from: FROM_ORDERS });
}

/**
 * Order delivered — sent when admin marks order as delivered
 */
async function sendOrderDelivered(user, order) {
  if (!user.email) return;

  const html = wrapper(`
    <h2 style="margin:0 0 8px;color:#282c3f;font-size:20px;">Order Delivered! </h2>
    <p style="margin:0 0 20px;color:#7e808c;font-size:14px;">Hi ${user.name || 'there'}, we hope you enjoy your meal!</p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#7e808c;font-size:13px;padding:4px 0;">Order ID</td>
          <td style="color:#282c3f;font-size:13px;font-weight:600;text-align:right;padding:4px 0;">#${order.id.slice(0, 8).toUpperCase()}</td>
        </tr>
        <tr>
          <td style="color:#7e808c;font-size:13px;padding:4px 0;">Status</td>
          <td style="text-align:right;padding:4px 0;">
            <span style="display:inline-block;background:#0e9f6e;color:#fff;padding:4px 14px;border-radius:20px;font-size:13px;font-weight:600;">Delivered</span>
          </td>
        </tr>
        <tr>
          <td style="color:#7e808c;font-size:13px;padding:4px 0;">Total</td>
          <td style="color:#fc8019;font-size:14px;font-weight:700;text-align:right;padding:4px 0;">${formatCurrency(order.totalAmount)}</td>
        </tr>
      </table>
    </div>

    <p style="margin:0;color:#7e808c;font-size:13px;">We'd love to hear your feedback! You can rate your order on the website.</p>
  `);

  return send({ to: user.email, subject: `Order Delivered — #${order.id.slice(0, 8).toUpperCase()}`, html, from: FROM_ORDERS });
}

/**
 * Order cancelled — sent when user or admin cancels the order
 */
async function sendOrderCancelled(user, order, cancelReason, cancelledBy) {
  if (!user.email) return;

  const who = cancelledBy === 'admin' ? 'our team' : 'you';

  const html = wrapper(`
    <h2 style="margin:0 0 8px;color:#282c3f;font-size:20px;">Order Cancelled</h2>
    <p style="margin:0 0 20px;color:#7e808c;font-size:14px;">Hi ${user.name || 'there'}, your order has been cancelled.</p>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#7e808c;font-size:13px;padding:4px 0;">Order ID</td>
          <td style="color:#282c3f;font-size:13px;font-weight:600;text-align:right;padding:4px 0;">#${order.id.slice(0, 8).toUpperCase()}</td>
        </tr>
        <tr>
          <td style="color:#7e808c;font-size:13px;padding:4px 0;">Cancelled By</td>
          <td style="color:#282c3f;font-size:13px;text-align:right;padding:4px 0;text-transform:capitalize;">${who}</td>
        </tr>
        <tr>
          <td style="color:#7e808c;font-size:13px;padding:4px 0;vertical-align:top;">Reason</td>
          <td style="color:#dc2626;font-size:13px;text-align:right;padding:4px 0;">${cancelReason || 'No reason provided'}</td>
        </tr>
      </table>
    </div>

    ${order.paymentMethod === 'Online' && order.paymentStatus === 'Paid'
      ? '<p style="margin:0 0 16px;color:#7e808c;font-size:13px;">If you paid online, your refund will be processed within 5-7 business days.</p>'
      : ''
    }

    <p style="margin:0;color:#7e808c;font-size:13px;">We're sorry to see this. Feel free to place a new order anytime!</p>
  `);

  return send({ to: user.email, subject: `Order Cancelled — #${order.id.slice(0, 8).toUpperCase()}`, html, from: FROM_SUPPORT });
}

/**
 * New offer notification — sent to all users when admin creates an offer
 */
async function sendOfferEmail(users, offer) {
  const sendPromises = users.map(user => {
    if (!user.email) return Promise.resolve(null);

    const descriptionHtml = offer.description
      ? `<p style="margin:0 0 16px;color:#7e808c;font-size:14px;line-height:1.6;">${offer.description}</p>`
      : '';

    const html = wrapper(`
      <h2 style="margin:0 0 8px;color:#282c3f;font-size:20px;">New Offer! </h2>
      <p style="margin:0 0 20px;color:#7e808c;font-size:14px;">Hi ${user.name || 'there'}, check out this special offer from Lazeez!</p>

      <div style="background:linear-gradient(135deg,#fff7ed,#fef3c7);border:1px solid #fed7aa;border-radius:12px;padding:24px;margin-bottom:20px;text-align:center;">
        <h3 style="margin:0 0 8px;color:#282c3f;font-size:22px;font-weight:800;">${offer.name}</h3>
        ${descriptionHtml}
      </div>

      <div style="text-align:center;margin-top:24px;">
        <a href="${process.env.APP_URL || '#'}" style="display:inline-block;background:#fc8019;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Order Now</a>
      </div>
    `);

    return send({ to: user.email, subject: `${offer.name} — New Offer from Lazeez!`, html, from: FROM_OFFERS });
  });

  const results = await Promise.allSettled(sendPromises);
  const sent = results.filter(r => r.status === 'fulfilled' && r.value).length;
  console.log(`[email] Offer "${offer.name}" sent to ${sent}/${users.length} users`);
}

/**
 * Admin notification when a customer cancels their order
 */
async function sendAdminOrderCancelled(adminEmail, order, user) {
  if (!adminEmail) return;

  const userName = user.name || user.email || 'A customer';

  const html = wrapper(`
    <h2 style="margin:0 0 8px;color:#282c3f;font-size:20px;">Order Cancelled by Customer</h2>
    <p style="margin:0 0 20px;color:#7e808c;font-size:14px;">A customer has cancelled their order.</p>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#7e808c;font-size:13px;padding:4px 0;">Customer</td>
          <td style="color:#282c3f;font-size:13px;font-weight:600;text-align:right;padding:4px 0;">${userName}</td>
        </tr>
        <tr>
          <td style="color:#7e808c;font-size:13px;padding:4px 0;">Order ID</td>
          <td style="color:#282c3f;font-size:13px;font-weight:600;text-align:right;padding:4px 0;">#${order.id.slice(0, 8).toUpperCase()}</td>
        </tr>
        <tr>
          <td style="color:#7e808c;font-size:13px;padding:4px 0;">Amount</td>
          <td style="color:#fc8019;font-size:14px;font-weight:700;text-align:right;padding:4px 0;">${formatCurrency(order.totalAmount)}</td>
        </tr>
      </table>
    </div>
  `);

  return send({ to: adminEmail, subject: `Customer Cancelled Order — #${order.id.slice(0, 8).toUpperCase()}`, html, from: FROM_SUPPORT });
}

/**
 * Refund completed — sent when admin marks refund as transferred
 */
async function sendRefundCompleted(user, order) {
  if (!user.email) return;

  const html = wrapper(`
    <h2 style="margin:0 0 8px;color:#282c3f;font-size:20px;">Refund Processed </h2>
    <p style="margin:0 0 20px;color:#7e808c;font-size:14px;">Hi ${user.name || 'there'}, your refund has been processed successfully.</p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#7e808c;font-size:13px;padding:4px 0;">Order ID</td>
          <td style="color:#282c3f;font-size:13px;font-weight:600;text-align:right;padding:4px 0;">#${order.id.slice(0, 8).toUpperCase()}</td>
        </tr>
        <tr>
          <td style="color:#7e808c;font-size:13px;padding:4px 0;">Refund Amount</td>
          <td style="color:#0e9f6e;font-size:16px;font-weight:700;text-align:right;padding:4px 0;">${formatCurrency(order.totalAmount)}</td>
        </tr>
        <tr>
          <td style="color:#7e808c;font-size:13px;padding:4px 0;">Status</td>
          <td style="text-align:right;padding:4px 0;">
            <span style="display:inline-block;background:#0e9f6e;color:#fff;padding:4px 14px;border-radius:20px;font-size:13px;font-weight:600;">Completed</span>
          </td>
        </tr>
      </table>
    </div>

    <p style="margin:0;color:#7e808c;font-size:13px;">The refund has been transferred to your original payment method. It may take 5-7 business days to reflect in your account.</p>
  `);

  return send({ to: user.email, subject: `Refund Processed — #${order.id.slice(0, 8).toUpperCase()}`, html, from: FROM_SUPPORT });
}

module.exports = {
  sendOrderConfirmation,
  sendOrderStatusUpdate,
  sendOrderDelivered,
  sendOrderCancelled,
  sendOfferEmail,
  sendAdminOrderCancelled,
  sendRefundCompleted
};
