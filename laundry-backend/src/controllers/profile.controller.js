const User = require('../models/user.model');
const Address = require('../models/address.model');
const Review = require('../models/review.model');
const { Wallet } = require('../models/wallet.model');
const { Booking } = require('../models/booking.model');
const { Location } = require('../models/location.model');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/v1/profile
 * Get full profile with summary counts (for profile screen)
 */
const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: ['id', 'name', 'email', 'phone', 'countryCode', 'avatar', 'role', 'isProfileComplete', 'isVerified'],
      // Staff (drivers, managers) see the store they work for; null for customers
      include: [{ model: Location, as: 'location', attributes: ['id', 'name', 'code', 'phone', 'addressLine', 'city', 'pincode'] }],
    });

    if (!user) return sendError(res, 404, 'User not found');

    // Get counts
    const [ordersCount, addressCount, reviewCount, wallet] = await Promise.all([
      Booking.count({ where: { userId } }),
      Address.count({ where: { userId } }),
      Review.count({ where: { userId } }),
      Wallet.findOne({ where: { userId }, attributes: ['balance'] }),
    ]);

    return sendSuccess(res, 200, 'Profile fetched', {
      user,
      summary: {
        ordersCount,
        addressCount,
        reviewCount,
        walletBalance: wallet ? parseFloat(wallet.balance) : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/profile
 * Update profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return sendError(res, 404, 'User not found');

    const { name, email, avatar } = req.body;

    if (name) user.name = name;
    if (email) user.email = email;
    if (avatar) user.avatar = avatar;

    // Mark profile as complete if name is set
    if (name && !user.isProfileComplete) {
      user.isProfileComplete = true;
    }

    await user.save();

    return sendSuccess(res, 200, 'Profile updated', {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      isProfileComplete: user.isProfileComplete,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/profile/device-token
 * Update device token for push notifications
 */
const updateDeviceToken = async (req, res, next) => {
  try {
    const { deviceToken } = req.body;
    await User.update({ deviceToken }, { where: { id: req.user.id } });
    return sendSuccess(res, 200, 'Device token updated');
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile, updateDeviceToken };
