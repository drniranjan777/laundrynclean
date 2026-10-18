const express = require('express');
const router = express.Router();
const contentController = require('../controllers/content.controller');

// All public routes
router.get('/faq', contentController.getFAQs);
router.get('/disclaimer', contentController.getDisclaimer);
router.get('/:slug', contentController.getContentBySlug);

module.exports = router;
