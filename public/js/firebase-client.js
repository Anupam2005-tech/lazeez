function showAlert(msg) {
  if (typeof RestoAlert !== 'undefined' && RestoAlert.show) {
    RestoAlert.show(msg);
  } else {
    alert(msg);
  }
}

// Initialize Firebase
const firebaseConfig = window.FIREBASE_CONFIG || {};

// Initialize if keys are present
if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
}

const auth = typeof firebase !== 'undefined' && firebase.apps.length ? firebase.auth() : null;

async function verifyTokenOnServer(idToken, endpoint = '/auth/verify-token', recaptchaToken = '') {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, recaptchaToken })
    });
    const data = await response.json();
    if (data.success) {
      window.location.reload();
    } else {
      showAlert(data.error || 'Authentication failed');
    }
  } catch (err) {
    console.error(err);
    showAlert('Server error during authentication');
  }
}

async function handleEmailLogin(email, password, endpoint = '/auth/verify-token', recaptchaToken = '') {
  if (!auth) {
    showAlert('Firebase not configured');
    return;
  }

  try {
    const userCred = await auth.signInWithEmailAndPassword(email, password);
    const token = await userCred.user.getIdToken();
    await verifyTokenOnServer(token, endpoint, recaptchaToken);
  } catch (err) {
    console.error(err);
    showAlert(err.message);
  }
}

async function handleGoogleLogin(endpoint = '/auth/verify-token') {
  if (!auth) {
    showAlert('Firebase not configured');
    return;
  }

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    const token = await result.user.getIdToken();
    await verifyTokenOnServer(token, endpoint);
  } catch (err) {
    console.error(err);
    showAlert(err.message);
  }
}

async function handleLogout(endpoint = '/auth/logout', redirectTo = '/') {
  if (auth) {
    await auth.signOut();
  }
  fetch(endpoint, { method: 'POST' }).then(() => {
    window.location.href = redirectTo;
  });
}

async function handleEmailRegister(email, password, name, endpoint = '/auth/verify-token', recaptchaToken = '') {
  if (!auth) {
    showAlert('Firebase not configured');
    return;
  }

  try {
    const userCred = await auth.createUserWithEmailAndPassword(email, password);
    if (name) {
      await userCred.user.updateProfile({ displayName: name });
    }
    const token = await userCred.user.getIdToken();
    await verifyTokenOnServer(token, endpoint, recaptchaToken);
  } catch (err) {
    console.error(err);
    showAlert(err.message);
  }
}

// Phone OTP state
let phoneConfirmationResult = null;
let phoneRecaptchaVerifier = null;
let otpEndpoint = '/auth/verify-token';

function showOtpModal(endpoint = '/auth/verify-token') {
  otpEndpoint = endpoint;
  if (phoneRecaptchaVerifier) {
    phoneRecaptchaVerifier.clear();
    phoneRecaptchaVerifier = null;
  }
  phoneConfirmationResult = null;
  const modal = document.getElementById('otpModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('otpPhoneStep').classList.remove('hidden');
    document.getElementById('otpVerifyStep').classList.add('hidden');
    document.getElementById('otpModalTitle').textContent = 'Enter Phone Number';
    document.getElementById('otpPhoneInput').value = '';
    document.getElementById('otpCodeInput').value = '';
  }
}

function closeOtpModal() {
  const modal = document.getElementById('otpModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function sendOtp() {
  const phoneNumber = '+91' + document.getElementById('otpPhoneInput').value.trim();
  if (!phoneNumber || phoneNumber === '+91') {
    showAlert('Please enter a phone number');
    return;
  }

  if (!auth) {
    showAlert('Phone login requires Firebase configuration');
    return;
  }

  // Use v2 reCAPTCHA key for Firebase Phone Auth
  var v2Key = window.RECAPTCHA_V2_SITE_KEY || window.RECAPTCHA_SITE_KEY;

  try {
    if (phoneRecaptchaVerifier) {
      phoneRecaptchaVerifier.clear();
      phoneRecaptchaVerifier = null;
    }
    const container = document.getElementById('otpRecaptchaContainer');
    container.innerHTML = '';
    phoneRecaptchaVerifier = new firebase.auth.RecaptchaVerifier(container, {
      size: 'invisible',
      'sitekey': v2Key
    });

    phoneConfirmationResult = await auth.signInWithPhoneNumber(phoneNumber, phoneRecaptchaVerifier);
    document.getElementById('otpPhoneStep').classList.add('hidden');
    document.getElementById('otpVerifyStep').classList.remove('hidden');
    document.getElementById('otpModalTitle').textContent = 'Verify OTP';
    document.getElementById('otpPhoneDisplay').textContent = 'OTP sent to ' + phoneNumber;
  } catch (err) {
    console.error('Phone OTP error:', err);
    showAlert(err.message || 'Failed to send OTP');
    if (phoneRecaptchaVerifier) {
      phoneRecaptchaVerifier.clear();
      phoneRecaptchaVerifier = null;
    }
  }
}

async function verifyOtp() {
  const otp = document.getElementById('otpCodeInput').value.trim();
  if (!otp || otp.length < 6) {
    showAlert('Please enter a valid 6-digit OTP');
    return;
  }

  if (!phoneConfirmationResult) {
    showAlert('Please send OTP first');
    return;
  }

  try {
    const result = await phoneConfirmationResult.confirm(otp);
    const token = await result.user.getIdToken();
    closeOtpModal();
    await verifyTokenOnServer(token, otpEndpoint);
  } catch (err) {
    console.error('OTP verification error:', err);
    showAlert('Invalid OTP. Please try again.');
  }
}

// Global expose
window.RestoAuth = {
  handleEmailLogin,
  handleEmailRegister,
  handleGoogleLogin,
  handleLogout,
  verifyTokenOnServer,
  showOtpModal,
  closeOtpModal,
  sendOtp,
  verifyOtp
};
