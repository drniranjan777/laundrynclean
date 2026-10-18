const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { body, query } = require('express-validator');
const { validate } = require('../middlewares/validation.middleware');

// Public - check serviceability
router.post('/check-pincode', [
  body('pincode')
    .trim()
    .notEmpty().withMessage('Pincode is required')
    .isLength({ min: 6, max: 6 }).withMessage('Pincode must be 6 digits')
    .isNumeric().withMessage('Pincode must contain only digits'),
], validate, locationController.checkPincode);

router.post('/check-coordinates', [
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
], validate, locationController.checkCoordinates);

// Public - get serviceable areas
router.get('/serviceable-areas', locationController.getServiceableAreas);

// Authenticated - save user location
router.post('/save', authenticate, [
  body('pincode')
    .trim()
    .notEmpty().withMessage('Pincode is required')
    .isLength({ min: 6, max: 6 }).withMessage('Pincode must be 6 digits'),
  body('lat').optional().isFloat().withMessage('Invalid latitude'),
  body('lng').optional().isFloat().withMessage('Invalid longitude'),
], validate, locationController.saveUserLocation);

module.exports = router;
