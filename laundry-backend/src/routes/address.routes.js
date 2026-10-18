const express = require('express');
const router = express.Router();
const addressController = require('../controllers/address.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { body } = require('express-validator');
const { validate } = require('../middlewares/validation.middleware');

router.use(authenticate);

router.get('/', addressController.getAddresses);

router.post('/', [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('addressLine').trim().notEmpty().withMessage('Address is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('pincode').trim().notEmpty().isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit pincode required'),
], validate, addressController.addAddress);

router.put('/:id', [
  body('fullName').optional().trim().notEmpty(),
  body('addressLine').optional().trim().notEmpty(),
  body('city').optional().trim().notEmpty(),
], validate, addressController.updateAddress);

router.patch('/:id/set-default', addressController.setDefault);
router.delete('/:id', addressController.deleteAddress);

module.exports = router;
