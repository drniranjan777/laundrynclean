const express = require('express');
const router = express.Router();
const onboardingController = require('../controllers/onboarding.controller');

// Public routes - no auth needed
router.get('/slides', onboardingController.getSlides);
router.get('/app-config', onboardingController.getAppConfig);

module.exports = router;
