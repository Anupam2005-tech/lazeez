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
    // Use full-page redirect instead of popup for better mobile compatibility
    await auth.signInWithRedirect(provider);
  } catch (err) {
    console.error(err);
    showAlert(err.message);
  }
}

// Handle the redirect result when the page loads after Google sign-in
async function handleRedirectResult() {
  if (!auth) return;
  try {
    const result = await auth.getRedirectResult();
    if (result && result.user) {
      const token = await result.user.getIdToken();
      await verifyTokenOnServer(token);
    }
  } catch (err) {
    console.error('Redirect result error:', err);
    if (err.code !== 'auth/no-auth-event') {
      showAlert(err.message || 'Google login failed');
    }
  }
}

// Process redirect result on page load
if (auth) {
  handleRedirectResult();
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

// Global expose
window.RestoAuth = {
  handleEmailLogin,
  handleEmailRegister,
  handleGoogleLogin,
  handleLogout,
  verifyTokenOnServer
};
