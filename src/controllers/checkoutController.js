const db = require('../config/db');
const realtime = require('../services/realtime');
const emailService = require('../services/email');

const RESTAURANT_LAT = parseFloat(process.env.RESTAURANT_LAT) || 23.5492425;
const RESTAURANT_LNG = parseFloat(process.env.RESTAURANT_LNG) || 91.4668604;

// Precise Haversine distance calculation
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateDistanceFee(lat, lng, settings) {
  const distance = getDistance(RESTAURANT_LAT, RESTAURANT_LNG, lat, lng);
  
  let fee = 0;
  if (distance <= 20) {
    fee = Math.ceil(distance / 5) * settings.deliveryRatePer5km;
  } else {
    // First 20km at base rate (20/5 = 4 units)
    fee = 4 * settings.deliveryRatePer5km;
    // Remaining distance at higher rate (₹20 per 5km)
    const extraDistance = distance - 20;
    const extraUnits = Math.ceil(extraDistance / 5);
    fee += extraUnits * 20;
  }
  
  // Minimum fee of ₹10 if distance is very small but not 0
  if (distance > 0 && fee < 10) fee = 10;
  
  return { fee, distance };
}

async function getSettings() {
  try {
    const settings = await db.setting.findMany();
    const result = {};
    settings.forEach(s => { result[s.key] = s.value; });
    return {
      deliveryRatePer5km: parseFloat(result.deliveryRatePer5km || '10'),
      platformFee: parseFloat(result.platformFee || '5')
    };
  } catch (e) {
    return { deliveryRatePer5km: 10, platformFee: 5 };
  }
}

async function showCheckout(req, res) {
  const cart = req.session.cart;
  if (cart.length === 0) return res.redirect('/menu');

  const itemTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

  const userData = await db.user.findUnique({ where: { id: req.session.user.id } });
  const settings = await getSettings();

  // Get saved addresses
  let savedAddresses = await db.savedAddress.findMany({
    where: { userId: req.session.user.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
  });

  // Auto-migrate legacy address if no saved addresses exist
  if (savedAddresses.length === 0 && userData && userData.address) {
    const addr = await db.savedAddress.create({
      data: {
        userId: req.session.user.id,
        label: 'Home',
        flatNo: userData.flatNo,
        address: userData.address,
        landmark: userData.landmark,
        pincode: userData.pincode,
        lat: userData.lat,
        lng: userData.lng,
        isDefault: true
      }
    });
    savedAddresses = [addr];
  }

  let deliveryFee = 40;
  let distanceKm = 0;
  if (userData && userData.lat && userData.lng) {
    const calculation = calculateDistanceFee(userData.lat, userData.lng, settings);
    deliveryFee = calculation.fee;
    distanceKm = calculation.distance;
  }

  const grandTotal = itemTotal + deliveryFee + settings.platformFee;

  res.render('storefront/checkout', {
    title: 'Checkout',
    cart,
    itemTotal,
    deliveryFee,
    platformFee: settings.platformFee,
    grandTotal,
    userData: userData || {},
    savedAddresses,
    distanceKm,
    robots: 'noindex, nofollow'
  });
}

async function createCheckoutSession(req, res) {
  const cart = req.session.cart;
  if (cart.length === 0) return res.status(400).send('Cart is empty');

  const { dineIn, address, customerName, customerPhone } = req.body;
  const isDineIn = dineIn === 'true' || dineIn === 'on';
  const itemTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

  try {
    const userData = await db.user.findUnique({ where: { id: req.session.user.id } });
    if (!userData) return res.status(401).send('User not found');

    if (!userData.phone || !userData.email) {
      return res.status(400).send('Phone number and email are required to place an order.');
    }

    if (!isDineIn && !address) {
      return res.status(400).send('Address is required for delivery');
    }

    const settings = await getSettings();

    let deliveryFee = 40;
    if (userData && userData.lat && userData.lng) {
      const calculation = calculateDistanceFee(userData.lat, userData.lng, settings);
      deliveryFee = calculation.fee;
    }

    const totalAmount = itemTotal + deliveryFee + settings.platformFee;
    
    const encryption = require('../utils/encryption');

    // Create the order immediately as Paid (simulating successful fake card tx)
    const order = await db.order.create({
      data: {
        userId: userData.id,
        status: 'Pending',
        itemTotal,
        deliveryFee,
        platformFee: settings.platformFee,
        totalAmount,
        address: address || '',
        customerName: customerName || userData.name || '',
        customerPhone: encryption.encrypt(customerPhone || userData.phone || null),
        paymentMethod: 'Online (Card)',
        paymentStatus: 'Paid',
        paymentTimestamp: new Date(),
        dineIn: false,
        items: {
          create: cart.map(item => ({
            menuItemId: item.id,
            quantity: item.quantity,
            unitPrice: item.price
          }))
        }
      }
    });

    // Send realtime event with dish names
    const itemsSummary = cart.map(item => item.name + ' x' + item.quantity).join(', ');
    realtime.broadcastOrderEvent('order:new', {
      orderId: order.id,
      userId: order.userId,
      totalAmount: order.totalAmount,
      status: order.status,
      customerName: order.customerName,
      dineIn: order.dineIn,
      createdAt: order.createdAt,
      itemsSummary
    });

    // Clear cart
    req.session.cart = [];
    req.session.save();

    // Send Email async
    db.order.findUnique({
      where: { id: order.id },
      include: { items: { include: { menuItem: true } } }
    }).then(fullOrder => {
      if (fullOrder) {
        emailService.sendOrderConfirmation(userData, fullOrder);
      }
    }).catch(err => console.error('[email] Order confirmation failed:', err));

    res.json({
      success: true,
      orderId: order.id,
      message: 'Payment received successfully!'
    });
  } catch (err) {
    console.error('Checkout processing error:', err);
    res.status(500).json({ success: false, error: 'Checkout failed' });
  }
}

async function orderSuccess(req, res) {
  const orderId = req.params.id;
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { menuItem: true } } }
    });
    if (!order || order.userId !== req.session.user.id) return res.redirect('/');
    res.render('storefront/order-success', {
      title: 'Order Successful',
      order,
      robots: 'noindex, nofollow',
      itemsSummary: order.items.map(i => i.menuItem ? i.menuItem.name : 'Item').join(', ')
    });
  } catch (err) {
    res.redirect('/');
  }
}

module.exports = { showCheckout, createCheckoutSession, orderSuccess };
