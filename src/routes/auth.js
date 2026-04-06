const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const validate = require('../middleware/validate');
const { tokenSchema, profileSchema } = require('../schemas/authSchema');

router.get('/login', authController.showLogin);
router.get('/register', authController.showRegister);
router.post('/verify-token', validate(tokenSchema), authController.verifyToken);
router.post('/local-login', authController.localLogin);
router.post('/local-register', authController.localRegister);
router.post('/logout', authController.logout);
router.get('/profile', authController.getProfile);
router.post('/profile', validate(profileSchema), authController.updateProfile);
router.post('/onboarding-done', authController.onboardingDone);

module.exports = router;
