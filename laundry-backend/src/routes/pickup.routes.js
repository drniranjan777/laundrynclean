const express = require('express');
const router = express.Router();
const pickupController = require('../controllers/pickup.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Schedule Pickup (bulk orders) for signed-in customers. Every check is repeated on the server when booking.
router.use(authenticate);

router.get('/config', pickupController.getConfig);
router.get('/dates', pickupController.getDates);
router.get('/slots', pickupController.getSlots);
router.post('/quote', pickupController.getQuote);
router.post('/', pickupController.createPickup);

module.exports = router;
