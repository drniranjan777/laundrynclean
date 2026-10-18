const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { body } = require('express-validator');
const { validate } = require('../middlewares/validation.middleware');

router.use(authenticate);

router.get('/', profileController.getProfile);

router.put('/', [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
], validate, profileController.updateProfile);

router.put('/device-token', [
  body('deviceToken').notEmpty().withMessage('Device token is required'),
], validate, profileController.updateDeviceToken);

module.exports = router;
