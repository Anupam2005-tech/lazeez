const db = require('../config/db');

function calculateTotal(cart) {
  return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

function isJsonRequest(req) {
  return (req.headers.accept || '').includes('application/json') ||
    req.get('X-Requested-With') === 'XMLHttpRequest';
}

function cartResponse(req) {
  const cart = req.session.cart || [];
  return {
    success: true,
    cartCount: cart.length,
    totalAmount: calculateTotal(cart),
    cart: JSON.parse(JSON.stringify(cart))
  };
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

async function showCart(req, res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const settings = await getSettings();
  res.render('storefront/cart', {
    title: 'Your Cart',
    cart: req.session.cart,
    total: calculateTotal(req.session.cart),
    deliveryFee: 0,
    platformFee: settings.platformFee,
    deliveryRatePer5km: settings.deliveryRatePer5km,
    robots: 'noindex, nofollow'
  });
}

async function addItem(req, res) {
  const { menuItemId } = req.body;
  const wantsJson = isJsonRequest(req);

  try {
    const item = await db.menuItem.findUnique({ where: { id: menuItemId } });
    if (!item || !item.available) {
      if (wantsJson) return res.status(400).json({ success: false, error: 'Item not available' });
      return res.status(400).send('Item not available');
    }

    const cart = req.session.cart || [];
    const existingIndex = cart.findIndex(c => String(c.id) === String(item.id));

    if (existingIndex > -1) {
      cart[existingIndex].quantity += 1;
    } else {
      cart.push({ id: item.id, name: item.name, price: item.price, image: item.image, quantity: 1 });
    }
    req.session.cart = cart;

    req.session.save(() => {
      if (wantsJson) return res.json(cartResponse(req));
      return res.redirect('/cart');
    });
  } catch (err) {
    console.error(err);
    if (wantsJson) return res.status(500).json({ success: false, error: 'Server Error' });
    res.status(500).send('Server Error');
  }
}

function removeItem(req, res) {
  const { id } = req.body;
  const wantsJson = isJsonRequest(req);
  const cart = req.session.cart || [];
  req.session.cart = cart.filter(item => String(item.id) !== String(id));
  req.session.save(() => {
    if (wantsJson) return res.json(cartResponse(req));
    res.redirect('/cart');
  });
}

function updateItem(req, res) {
  const { id, quantity } = req.body;
  const qty = parseInt(quantity, 10);
  const wantsJson = isJsonRequest(req);

  const cart = req.session.cart || [];
  const item = cart.find(c => String(c.id) === String(id));
  if (item) {
    if (qty > 0) item.quantity = qty;
    else req.session.cart = cart.filter(c => String(c.id) !== String(id));
  }

  req.session.save(() => {
    if (wantsJson) return res.json(cartResponse(req));
    res.redirect('/cart');
  });
}

function apiState(req, res) {
  const cart = req.session.cart || [];
  res.json({
    cartCount: cart.length,
    totalAmount: calculateTotal(cart),
    cart: JSON.parse(JSON.stringify(cart))
  });
}

module.exports = { showCart, addItem, removeItem, updateItem, apiState };
