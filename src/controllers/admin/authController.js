const admin = require('../../config/firebase-admin');
const bcrypt = require('bcryptjs');
const db = require('../../config/db');

function showLogin(req, res) {
  if (req.session.user && req.session.user.role === 'admin') {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', { title: 'Admin Login', layout: false });
}

async function verifyToken(req, res) {
  try {
    const { idToken, recaptchaToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'No token' });

    // Verify reCAPTCHA v3
    if (process.env.RECAPTCHA_SECRET_KEY && recaptchaToken) {
      const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success || verifyData.score < 0.5) {
        return res.status(403).json({ error: 'reCAPTCHA verification failed. Please try again.' });
      }
    }

    let email, uid;

    if (admin.apps.length > 0) {
      const decoded = await admin.auth().verifyIdToken(idToken);
      uid = decoded.uid;
      email = decoded.email;
    } else {
      return res.status(500).json({ error: 'Firebase Admin not configured' });
    }

    let user = await db.user.findUnique({ where: { firebaseUid: uid } });

    if (!user) {
      // Try finding by email in case user was created via local auth
      user = await db.user.findFirst({ where: { email } });
    }

    if (!user) {
      return res.status(403).json({ error: 'Not authorized as admin. Account not found. Sign in on the storefront first, then ask an existing admin to upgrade your account.' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized as admin. Ask an existing admin to upgrade your account by running: node scripts/create-admin.js ' + (email || 'your-email') });
    }

    req.session.user = {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      role: user.role
    };

    res.json({ success: true, user: req.session.user });
  } catch (error) {
    console.error('Admin Auth Error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}

function logout(req, res) {
  req.session.destroy();
  res.json({ success: true });
}

async function localLogin(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await db.user.findFirst({ where: { email: email.toLowerCase().trim() } });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized as admin' });
    }

    req.session.user = {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      role: user.role
    };

    res.json({ success: true, user: req.session.user });
  } catch (error) {
    console.error('Admin local login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

module.exports = { showLogin, verifyToken, logout, localLogin };
