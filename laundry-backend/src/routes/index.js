const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const profileRoutes = require('./profile.routes');
const addressRoutes = require('./address.routes');
const locationRoutes = require('./location.routes');
const onboardingRoutes = require('./onboarding.routes');
const walletRoutes = require('./wallet.routes');
const subscriptionRoutes = require('./subscription.routes');
const promocodeRoutes = require('./promocode.routes');
const categoryRoutes = require('./category.routes');
const cartRoutes = require('./cart.routes');
const bookingRoutes = require('./booking.routes');
const reviewRoutes = require('./review.routes');
const contentRoutes = require('./content.routes');
const driverRoutes = require('./driver.routes');
const adminRoutes = require('./admin.routes');

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/addresses', addressRoutes);
router.use('/location', locationRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/wallet', walletRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/promocodes', promocodeRoutes);
router.use('/categories', categoryRoutes);
router.use('/cart', cartRoutes);
router.use('/bookings', bookingRoutes);
router.use('/reviews', reviewRoutes);
router.use('/content', contentRoutes);
router.use('/drivers', driverRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
