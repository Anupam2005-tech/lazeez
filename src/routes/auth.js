const express = require('express');
const router = express.Router();

const validate = require('../middleware/validate');
const { tokenSchema, profileSchema } = require('../schemas/authSchema');

router.get('/login', (req, res, next) => require('../controllers/authController').showLogin(req, res, next));
router.get('/register', (req, res, next) => require('../controllers/authController').showRegister(req, res, next));
router.post('/verify-token', validate(tokenSchema), (req, res, next) => require('../controllers/authController').verifyToken(req, res, next));
router.post('/local-login', (req, res, next) => require('../controllers/authController').localLogin(req, res, next));
router.post('/local-register', (req, res, next) => require('../controllers/authController').localRegister(req, res, next));
router.post('/logout', (req, res, next) => require('../controllers/authController').logout(req, res, next));
router.get('/profile', (req, res, next) => require('../controllers/authController').getProfile(req, res, next));
router.post('/profile', validate(profileSchema), (req, res, next) => require('../controllers/authController').updateProfile(req, res, next));
router.post('/onboarding-done', (req, res, next) => require('../controllers/authController').onboardingDone(req, res, next));

module.exports = router;
