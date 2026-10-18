const { verifyToken } = require('../config/jwt');
const User = require('../models/user.model');
const { sendError } = require('../utils/response');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'Access denied. No token provided.');
  }

  let decoded;
  try {
    decoded = verifyToken(authHeader.split(' ')[1]);
  } catch (error) {
    return sendError(res, 401, 'Invalid or expired token');
  }

  try {
    // Load the user on every request so blocking a user or changing their
    // role takes effect immediately instead of when their token expires.
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'role', 'phone', 'email', 'isActive', 'locationId'],
    });
    if (!user) {
      return sendError(res, 401, 'Invalid or expired token');
    }
    if (!user.isActive) {
      return sendError(res, 403, 'Your account has been blocked. Please contact support.');
    }
    if (user.role === 'manager' && !user.locationId) {
      return sendError(res, 403, 'Your account is not linked to a location. Please contact the admin.');
    }

    req.user = { id: user.id, role: user.role, phone: user.phone, email: user.email, locationId: user.locationId };
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * For public endpoints that can personalise for a signed-in user (e.g. location prices).
 * Sets req.user = { id } when a valid token is sent; otherwise carries on anonymously.
 */
const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.user = { id: verifyToken(authHeader.split(' ')[1]).id };
    } catch (error) {
      // Invalid or expired token: treat as anonymous
    }
  }
  next();
};

module.exports = { authenticate, optionalAuthenticate };
