const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { optionalAuthenticate } = require('../middlewares/auth.middleware');

// Public routes. Item prices follow the customer's store: ?locationId, ?pincode,
// or (when signed in) the pincode of their default address.
router.get('/', categoryController.getCategories);
router.get('/items/search', optionalAuthenticate, categoryController.searchItems);
router.get('/:categoryId/items', optionalAuthenticate, categoryController.getItems);
router.get('/items/:itemId', optionalAuthenticate, categoryController.getItemById);

module.exports = router;
