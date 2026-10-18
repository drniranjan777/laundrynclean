const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const { Booking } = require('../models/booking.model');
const { Wallet } = require('../models/wallet.model');
const { Location } = require('../models/location.model');
const { generateToken, generateRefreshToken } = require('../config/jwt');
const { sendSuccess, sendError } = require('../utils/response');
const { locationFilter } = require('../utils/location-scope');
const { Op } = require('sequelize');

/**
 * POST /api/v1/admin/login
 * Admin login with email + password
 */
const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Admins and branch managers share the admin panel login
    const user = await User.findOne({
      where: { email, role: { [Op.in]: ['admin', 'manager'] } },
      include: [{ model: Location, as: 'location', attributes: ['id', 'name', 'code', 'isActive'] }],
    });
    if (!user) {
      return sendError(res, 401, 'Invalid email or password');
    }

    if (!user.password) {
      return sendError(res, 401, 'Password not set for this account');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return sendError(res, 401, 'Invalid email or password');
    }

    if (!user.isActive) {
      return sendError(res, 403, 'Your account has been deactivated');
    }
    if (user.role === 'manager' && !user.location?.isActive) {
      return sendError(res, 403, 'Your location is not active. Please contact the admin.');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken({ id: user.id, role: user.role, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id });

    return sendSuccess(res, 200, 'Login successful', {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        location: user.location ? { id: user.location.id, name: user.location.name, code: user.location.code } : null,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/dashboard
 */
const getDashboardStats = async (req, res, next) => {
  try {
    // Order figures follow the manager's / switcher's location; customers are shared by all locations
    const scope = locationFilter(req);
    const totalUsers = await User.count({ where: { role: 'customer' } });
    const totalDrivers = await User.count({ where: { role: 'driver', ...scope } });
    const totalOrders = await Booking.count({ where: scope });
    const deliveredOrders = await Booking.count({ where: { ...scope, status: 'delivered' } });
    const pendingOrders = await Booking.count({ where: { ...scope, status: { [Op.in]: ['pending', 'confirmed'] } } });

    // Revenue (sum of paid bookings)
    const { sequelize } = require('../config/db');
    const revenueResult = await Booking.findOne({
      where: { ...scope, paymentStatus: 'paid' },
      attributes: [[sequelize.fn('SUM', sequelize.col('total')), 'totalRevenue']],
      raw: true,
    });

    return sendSuccess(res, 200, 'Dashboard stats fetched', {
      users: totalUsers,
      drivers: totalDrivers,
      orders: totalOrders,
      deliveredOrders,
      pendingOrders,
      revenue: parseFloat(revenueResult?.totalRevenue || 0),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/users
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search, fromDate, toDate } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Drivers (Delivery Boys) and branch managers (Locations) are managed on their own pages
    const STAFF_ROLES = ['driver', 'manager'];
    const where = { role: { [Op.notIn]: STAFF_ROLES } };
    if (role) where.role = { [Op.eq]: role, [Op.notIn]: STAFF_ROLES };
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (fromDate || toDate) {
      where.created_at = {};
      if (fromDate) where.created_at[Op.gte] = new Date(fromDate);
      if (toDate) where.created_at[Op.lte] = new Date(toDate + 'T23:59:59');
    }

    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: ['id', 'name', 'email', 'phone', 'role', 'isVerified', 'isActive', 'lastLoginAt'],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    return sendSuccess(res, 200, 'Users fetched', {
      users: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/drivers
 */
const getAllDrivers = async (req, res, next) => {
  try {
    const drivers = await User.findAll({
      where: { role: 'driver', ...locationFilter(req) },
      attributes: ['id', 'name', 'phone', 'email', 'isActive'],
      order: [['created_at', 'DESC']],
    });

    return sendSuccess(res, 200, 'Drivers fetched', drivers);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/assign-driver
 */
const assignDriver = async (req, res, next) => {
  try {
    return sendSuccess(res, 200, 'Driver assigned');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/reports/revenue
 */
const getRevenueReport = async (req, res, next) => {
  try {
    return sendSuccess(res, 200, 'Revenue report fetched', {});
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/users/:id
 * Get detailed user profile with orders, wallet, addresses
 */
const getUserDetail = async (req, res, next) => {
  try {
    const Address = require('../models/address.model');
    const Review = require('../models/review.model');
    const { UserSubscription } = require('../models/subscription.model');

    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'name', 'email', 'phone', 'countryCode', 'role', 'avatar', 'isVerified', 'isActive', 'isProfileComplete', 'lastLoginAt'],
    });

    if (!user) return sendError(res, 404, 'User not found');

    // Get related data
    const [ordersCount, totalSpent, addresses, wallet, reviewsCount, subscription] = await Promise.all([
      Booking.count({ where: { userId: user.id } }),
      Booking.sum('total', { where: { userId: user.id, paymentStatus: 'paid' } }),
      Address.findAll({ where: { userId: user.id }, attributes: ['id', 'fullName', 'addressLine', 'city', 'pincode', 'isDefault'] }),
      Wallet.findOne({ where: { userId: user.id }, attributes: ['balance', 'totalCredited', 'totalDebited'] }),
      Review.count({ where: { userId: user.id } }),
      UserSubscription.findOne({ where: { userId: user.id, status: 'active' }, attributes: ['planId', 'status', 'endDate'] }),
    ]);

    // Recent orders
    const recentOrders = await Booking.findAll({
      where: { userId: user.id },
      attributes: ['id', 'orderNumber', 'total', 'status', 'pickupDate'],
      order: [['created_at', 'DESC']],
      limit: 5,
    });

    return sendSuccess(res, 200, 'User detail fetched', {
      user,
      stats: {
        ordersCount,
        totalSpent: parseFloat(totalSpent || 0),
        reviewsCount,
        walletBalance: wallet ? parseFloat(wallet.balance) : 0,
        walletTotalCredited: wallet ? parseFloat(wallet.totalCredited) : 0,
      },
      addresses,
      recentOrders,
      subscription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/users/:id/block
 * Block/Unblock a user
 */
const toggleBlockUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return sendError(res, 404, 'User not found');
    if (user.role === 'admin') return sendError(res, 403, 'Cannot block admin');

    user.isActive = !user.isActive;
    await user.save();

    return sendSuccess(res, 200, user.isActive ? 'User unblocked' : 'User blocked', {
      id: user.id,
      isActive: user.isActive,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { adminLogin, getDashboardStats, getAllUsers, getAllDrivers, assignDriver, getRevenueReport, getUserDetail, toggleBlockUser };
