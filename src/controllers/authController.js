const admin = require('../config/firebase-admin');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

function showLogin(req, res) {
  if (req.session.user) return res.redirect('/');
  res.render('auth/login', { title: 'Login', robots: 'noindex, nofollow' });
}

function showRegister(req, res) {
  if (req.session.user) return res.redirect('/');
  res.render('auth/register', { title: 'Register', robots: 'noindex, nofollow' });
}

async function verifyToken(req, res) {
  try {
    const { idToken, recaptchaToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'No token provided' });

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

    let email, phone, uid, name;

    if (admin.apps.length > 0) {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      uid = decodedToken.uid;
      email = decodedToken.email;
      phone = decodedToken.phone_number;
      name = decodedToken.name || null;
    } else {
      return res.status(500).json({ error: 'Firebase Admin not configured' });
    }

    const user = await db.user.upsert({
      where: { firebaseUid: uid },
      update: {
        email: email || undefined,
        phone: phone || undefined,
      },
      create: {
        firebaseUid: uid,
        email,
        phone,
        name,
        role: 'customer'
      }
    });

    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Admin accounts must use /admin/login' });
    }

    req.session.user = {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      flatNo: user.flatNo,
      landmark: user.landmark,
      pincode: user.pincode,
      address: user.address,
      lat: user.lat,
      lng: user.lng
    };

    req.session.showOnboarding = true;

    res.json({ success: true, user: req.session.user });
  } catch (error) {
    console.error('Error verifying token', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function updateProfile(req, res) {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { name, phone, email, flatNo, landmark, pincode, address, lat, lng } = req.body;

    // Block email change if user already has an email set
    const existingUser = await db.user.findUnique({
      where: { id: req.session.user.id },
      select: { email: true }
    });

    if (!existingUser) {
      req.session.destroy();
      return res.status(401).json({ error: 'User log session expired or user deleted' });
    }

    const data = {
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone }),
      ...(flatNo !== undefined && { flatNo }),
      ...(landmark !== undefined && { landmark }),
      ...(pincode !== undefined && { pincode }),
      ...(address !== undefined && { address }),
      ...(lat !== undefined && { lat: lat ? parseFloat(lat) : null }),
      ...(lng !== undefined && { lng: lng ? parseFloat(lng) : null }),
    };

    // Only allow setting email if user has no email yet (first-time onboarding)
    if (email !== undefined && !existingUser.email) {
      data.email = email;
    }

    const updated = await db.user.update({
      where: { id: req.session.user.id },
      data
    });

    req.session.user = {
      id: updated.id,
      firebaseUid: updated.firebaseUid,
      email: updated.email,
      phone: updated.phone,
      name: updated.name,
      role: updated.role,
      flatNo: updated.flatNo,
      landmark: updated.landmark,
      pincode: updated.pincode,
      address: updated.address,
      lat: updated.lat,
      lng: updated.lng
    };

    res.json({ success: true, user: req.session.user });
  } catch (error) {
    console.error('Error updating profile', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

async function getProfile(req, res) {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await db.user.findUnique({
      where: { id: req.session.user.id }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      flatNo: user.flatNo,
      landmark: user.landmark,
      pincode: user.pincode,
      address: user.address,
      lat: user.lat,
      lng: user.lng
    });
  } catch (error) {
    console.error('Error fetching profile', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
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

    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Admin accounts must use /admin/login' });
    }

    req.session.user = {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      flatNo: user.flatNo,
      landmark: user.landmark,
      pincode: user.pincode,
      address: user.address,
      lat: user.lat,
      lng: user.lng
    };

    req.session.showOnboarding = true;

    res.json({ success: true, user: req.session.user });
  } catch (error) {
    console.error('Local login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

async function localRegister(req, res) {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.user.findFirst({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await db.user.create({
      data: {
        firebaseUid: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        email: normalizedEmail,
        name: name || null,
        password: hash,
        role: 'customer',
      },
    });

    req.session.user = {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      flatNo: user.flatNo,
      landmark: user.landmark,
      pincode: user.pincode,
      address: user.address,
      lat: user.lat,
      lng: user.lng
    };

    req.session.showOnboarding = true;

    res.json({ success: true, user: req.session.user });
  } catch (error) {
    console.error('Local register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
}

function onboardingDone(req, res) {
  if (req.session) {
    req.session.onboardingDone = true;
    req.session.showOnboarding = false;
  }
  res.json({ success: true });
}

module.exports = { showLogin, showRegister, verifyToken, updateProfile, getProfile, logout, localLogin, localRegister, onboardingDone };
