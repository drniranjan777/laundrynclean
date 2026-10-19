const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const { Booking, BookingItem, TimeSlot } = require('../models/booking.model');
const Address = require('../models/address.model');
const { generateToken, generateRefreshToken } = require('../config/jwt');
const authService = require('../services/auth.service');
const { sendSuccess, sendError } = require('../utils/response');
const { canChangeStatus, cashDue } = require('../utils/helpers');
const { Location } = require('../models/location.model');
const { isUuid, scopedLocationId, locationFilter, canAccessLocation } = require('../utils/location-scope');

/** Location for a driver being created or moved: a manager's own, else the admin's choice */
const pickDriverLocation = async (req, requested) => {
  const locationId = req.user.role === 'manager' ? req.user.locationId : (isUuid(requested) ? requested : scopedLocationId(req));
  if (!locationId) return null;
  return Location.findByPk(locationId);
};
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');
const fs = require('fs/promises');
const BookingEvent = require('../models/booking-event.model');
const { saveDataUrlImage, uploadedFilePath } = require('../services/upload.service');

// ========== ADMIN: DELIVERY BOY MANAGEMENT ==========

// Delivery boys sign in to the driver app with an OTP to this number, so it must be a valid Indian mobile
const isMobile = (phone) => /^[6-9]\d{9}$/.test(phone);
const isEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
// '' or missing email = none (email + password is only for the older login)
const cleanEmail = (email) => (typeof email === 'string' && email.trim() ? email.trim() : null);

/** 409 message if another account already uses this phone or email, else null */
const accountConflict = async ({ phone, email, exceptId }) => {
  const others = exceptId ? { id: { [Op.ne]: exceptId } } : {};
  if (phone && await User.findOne({ where: { phone, ...others } })) {
    return 'Another account (customer or staff) already uses this phone number';
  }
  if (email && await User.findOne({ where: { email, ...others } })) {
    return 'Another account already uses this email';
  }
  return null;
};

/**
 * POST /api/v1/admin/delivery-boys
 * Create delivery boy account. Phone is the login (OTP in the driver app); email + password are optional.
 */
const createDeliveryBoy = async (req, res, next) => {
  try {
    const { name, password, vehicleType, locationId } = req.body;
    const phone = authService.normalisePhone(req.body.phone);
    const email = cleanEmail(req.body.email);
    if (!name || !req.body.phone) {
      return sendError(res, 422, 'Name and phone are required');
    }
    if (!isMobile(phone)) return sendError(res, 422, 'Enter a valid 10-digit mobile number');
    if (email && !isEmail(email)) return sendError(res, 422, 'Enter a valid email or leave it blank');

    const location = await pickDriverLocation(req, locationId);
    if (!location) return sendError(res, 422, 'Choose the location this delivery boy works at');

    const conflict = await accountConflict({ phone, email });
    if (conflict) return sendError(res, 409, conflict);

    const driver = await User.create({
      name,
      email,
      phone,
      password: password ? await bcrypt.hash(password, 12) : null,
      role: 'driver',
      locationId: location.id,
      isVerified: true,
      isActive: true,
      isProfileComplete: true,
    });

    return sendSuccess(res, 201, 'Delivery boy created', {
      id: driver.id,
      name: driver.name,
      email: driver.email,
      phone: driver.phone,
      role: driver.role,
      isActive: driver.isActive,
      location: { id: location.id, name: location.name, code: location.code },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/delivery-boys
 * List all delivery boys
 */
const getDeliveryBoys = async (req, res, next) => {
  try {
    const drivers = await User.findAll({
      where: { role: 'driver', ...locationFilter(req) },
      attributes: ['id', 'name', 'email', 'phone', 'isActive', 'isVerified', 'locationId'],
      include: [{ model: Location, as: 'location', attributes: ['id', 'name', 'code'] }],
      order: [['created_at', 'DESC']],
    });

    // Get assigned order count for each driver
    const driversWithStats = await Promise.all(drivers.map(async (driver) => {
      const activeOrders = await Booking.count({
        where: { driverId: driver.id, status: { [Op.notIn]: ['delivered', 'collected', 'cancelled'] } },
      });
      const totalDelivered = await Booking.count({
        where: { driverId: driver.id, status: 'delivered' },
      });
      return {
        ...driver.toJSON(),
        activeOrders,
        totalDelivered,
      };
    }));

    return sendSuccess(res, 200, 'Delivery boys fetched', driversWithStats);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/admin/delivery-boys/:id
 * Update delivery boy
 */
const updateDeliveryBoy = async (req, res, next) => {
  try {
    const driver = await User.findOne({ where: { id: req.params.id, role: 'driver' } });
    if (!driver || !canAccessLocation(req, driver.locationId)) return sendError(res, 404, 'Delivery boy not found');

    const { name, password, isActive, locationId } = req.body;
    const phone = req.body.phone ? authService.normalisePhone(req.body.phone) : undefined;
    const email = req.body.email === undefined ? undefined : cleanEmail(req.body.email);
    if (phone !== undefined && !isMobile(phone)) return sendError(res, 422, 'Enter a valid 10-digit mobile number');
    if (email && !isEmail(email)) return sendError(res, 422, 'Enter a valid email or leave it blank');
    const conflict = await accountConflict({ phone, email, exceptId: driver.id });
    if (conflict) return sendError(res, 409, conflict);

    if (name) driver.name = name;
    if (email !== undefined) driver.email = email; // '' clears it
    if (phone) driver.phone = phone;
    if (isActive !== undefined) driver.isActive = isActive;
    if (password) driver.password = await bcrypt.hash(password, 12);
    // Only an admin can move a delivery boy to another location
    if (locationId && req.user.role === 'admin') {
      const location = await pickDriverLocation(req, locationId);
      if (!location) return sendError(res, 404, 'Location not found');
      driver.locationId = location.id;
    }

    await driver.save();

    return sendSuccess(res, 200, 'Delivery boy updated', {
      id: driver.id, name: driver.name, email: driver.email,
      phone: driver.phone, isActive: driver.isActive, locationId: driver.locationId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/admin/delivery-boys/:id
 * Deactivate delivery boy
 */
const deleteDeliveryBoy = async (req, res, next) => {
  try {
    const driver = await User.findOne({ where: { id: req.params.id, role: 'driver' } });
    if (!driver || !canAccessLocation(req, driver.locationId)) return sendError(res, 404, 'Delivery boy not found');

    driver.isActive = false;
    await driver.save();

    return sendSuccess(res, 200, 'Delivery boy deactivated');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/bookings/:id/assign-driver
 * Assign a delivery boy to a booking
 */
const assignDriverToBooking = async (req, res, next) => {
  const { driverId } = req.body;
  if (!driverId) return sendError(res, 422, 'Driver ID is required');

  const t = await sequelize.transaction();
  try {
    // Lock the booking so a cancellation made meanwhile isn't overwritten below
    const booking = await Booking.findByPk(req.params.id, { lock: t.LOCK.UPDATE, transaction: t });
    if (!booking || !canAccessLocation(req, booking.locationId)) { await t.rollback(); return sendError(res, 404, 'Booking not found'); }

    const driver = await User.findOne({ where: { id: driverId, role: 'driver', isActive: true }, transaction: t });
    if (!driver) { await t.rollback(); return sendError(res, 404, 'Driver not found or inactive'); }
    if (booking.locationId && driver.locationId && driver.locationId !== booking.locationId) {
      await t.rollback();
      return sendError(res, 400, 'This delivery boy works at another location');
    }

    const fromStatus = booking.status;
    const reassigned = booking.driverId && booking.driverId !== driverId;
    booking.driverId = driverId;
    // Auto-update status to pickup_scheduled if currently confirmed
    if (['confirmed', 'pending'].includes(booking.status)) {
      booking.status = 'pickup_scheduled';
    }
    await booking.save({ transaction: t });
    // Order history (Order Status → History)
    await BookingEvent.create({
      bookingId: booking.id,
      actorId: req.user.id,
      type: 'driver_assigned',
      fromStatus,
      toStatus: booking.status,
      note: `${reassigned ? 'Reassigned' : 'Assigned'} to ${driver.name}`,
    }, { transaction: t });
    await t.commit();

    return sendSuccess(res, 200, 'Driver assigned', {
      bookingId: booking.id,
      orderNumber: booking.orderNumber,
      driverId: driver.id,
      driverName: driver.name,
      status: booking.status,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// ========== DRIVER: OWN ENDPOINTS ==========

/**
 * POST /api/v1/drivers/send-otp
 * Driver app login, step 1: OTP to a delivery boy's registered number (never creates an account)
 */
const driverSendOtp = async (req, res, next) => {
  try {
    const result = await authService.sendOtp(req.body, 'driver');
    return sendSuccess(res, 200, 'OTP sent successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/drivers/verify-otp
 * Driver app login, step 2: same response as /auth/verify-otp (user, token, refreshToken)
 */
const driverVerifyOtp = async (req, res, next) => {
  try {
    const result = await authService.verifyOtp(req.body, 'driver');
    return sendSuccess(res, 200, 'OTP verified successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/drivers/resend-otp
 */
const driverResendOtp = async (req, res, next) => {
  try {
    const result = await authService.resendOtp(req.body, 'driver');
    return sendSuccess(res, 200, 'OTP resent successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/driver/login
 * Delivery boy login with email + password
 */
const driverLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const driver = await User.findOne({ where: { email, role: 'driver' } });
    if (!driver) return sendError(res, 401, 'Invalid email or password');
    if (!driver.isActive) return sendError(res, 403, 'Your account is deactivated. Contact admin.');
    if (!driver.password) return sendError(res, 401, 'No password set for this account. Sign in with your mobile number and OTP.');

    const isValid = await bcrypt.compare(password, driver.password);
    if (!isValid) return sendError(res, 401, 'Invalid email or password');

    driver.lastLoginAt = new Date();
    await driver.save();

    const token = generateToken({ id: driver.id, role: driver.role, email: driver.email });
    const refreshToken = generateRefreshToken({ id: driver.id });

    return sendSuccess(res, 200, 'Login successful', {
      user: { id: driver.id, name: driver.name, email: driver.email, phone: driver.phone, role: driver.role },
      token,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/drivers/my-orders
 * Orders assigned to the logged-in driver, with what the driver app needs on the road.
 * Query: ?status=ready,out_for_delivery (one or more)  ?date=YYYY-MM-DD (pickup date)  ?page=1&limit=50 (max 100)
 * Still a plain array. Each order adds:
 * - stage: pickup | to_store | at_store | delivery | done | cancelled
 * - customer: { name, phone }
 * - address
 * - store: the order's location
 * - itemCount
 * - amountToCollect: cash due on delivery for unpaid COD orders (and billed bulk pickups not yet paid online)
 * - bookingType: standard | bulk_pickup (counted and billed after pickup, so it may have no items yet)
 */
const DRIVER_STAGES = {
  pending: 'pickup', confirmed: 'pickup', pickup_scheduled: 'pickup',
  picked_up: 'to_store', in_process: 'at_store',
  ready: 'delivery', out_for_delivery: 'delivery',
  ready_for_pickup: 'at_store', // the customer collects it at the shop
  delivered: 'done', collected: 'done', cancelled: 'cancelled',
};
const FINISHED_STATUSES = ['delivered', 'collected', 'cancelled'];

const getMyOrders = async (req, res, next) => {
  try {
    const statuses = String(req.query.status || '').split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.some(s => !DRIVER_STAGES[s])) return sendError(res, 422, `status must be one of: ${Object.keys(DRIVER_STAGES).join(', ')}`);
    const { date } = req.query;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return sendError(res, 422, 'date must be YYYY-MM-DD');
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const where = { driverId: req.user.id };
    if (statuses.length) where.status = statuses;
    if (date) where.pickupDate = date;

    // Finished orders newest first; open ones in the order the driver has to do them
    const finishedOnly = statuses.length > 0 && statuses.every(s => FINISHED_STATUSES.includes(s));
    const order = finishedOnly
      ? [['updated_at', 'DESC']]
      : [['pickupDate', 'ASC'], [{ model: TimeSlot, as: 'timeSlot' }, 'startTime', 'ASC'], ['created_at', 'ASC']];

    // Only to-one includes here, so LIMIT applies to bookings; items are loaded in one query below
    const bookings = await Booking.findAll({
      where,
      include: [
        { model: TimeSlot, as: 'timeSlot', attributes: ['label', 'startTime', 'endTime'] },
        { model: Address, as: 'address' },
        { model: User, as: 'user', attributes: ['id', 'name', 'phone'] },
        { model: Location, as: 'location', attributes: ['id', 'name', 'code', 'phone', 'addressLine', 'city', 'pincode'] },
      ],
      order,
      limit,
      offset: (page - 1) * limit,
    });

    const items = bookings.length
      ? await BookingItem.findAll({ where: { bookingId: bookings.map(b => b.id) }, order: [['created_at', 'ASC']] })
      : [];
    const itemsByBooking = new Map();
    for (const item of items) {
      if (!itemsByBooking.has(item.bookingId)) itemsByBooking.set(item.bookingId, []);
      itemsByBooking.get(item.bookingId).push(item.toJSON());
    }

    // Failed pickup / delivery attempts (newest first), so the driver sees what happened last time
    const failures = bookings.length
      ? await BookingEvent.findAll({
        where: { bookingId: bookings.map(b => b.id), type: ['pickup_failed', 'delivery_failed'] },
        order: [['created_at', 'DESC']],
      })
      : [];
    const failuresByBooking = new Map();
    for (const f of failures) {
      if (!failuresByBooking.has(f.bookingId)) failuresByBooking.set(f.bookingId, []);
      failuresByBooking.get(f.bookingId).push(f);
    }

    const orders = bookings.map((b) => {
      const { user, location, ...json } = b.toJSON();
      const bookingItems = itemsByBooking.get(b.id) || [];
      return {
        ...json,
        items: bookingItems,
        itemCount: bookingItems.reduce((sum, i) => sum + (i.quantity || 0), 0),
        stage: DRIVER_STAGES[b.status],
        // Address contact first (who is at the door), then a POS order's name, then the account
        customer: {
          name: json.address?.fullName || b.customerName || user?.name || null,
          phone: json.address?.phone || b.customerPhone || user?.phone || null,
        },
        store: location || null,
        amountToCollect: cashDue(b),
        failedAttempts: (failuresByBooking.get(b.id) || []).length,
        lastFailure: (() => {
          const last = (failuresByBooking.get(b.id) || [])[0];
          return last ? { type: last.type, reason: last.reason, note: last.note, at: last.created_at } : null;
        })(),
      };
    });

    return sendSuccess(res, 200, 'Orders fetched', orders);
  } catch (error) {
    next(error);
  }
};

const DRIVER_STATUSES = ['picked_up', 'in_process', 'out_for_delivery', 'delivered'];

/** Unpaid cash-on-delivery amount the driver has to collect (0 when nothing is due) */

/** Optional proof photo from the app (base64 data URL); saved before the transaction */
const savePhoto = (photo, bookingId) => (photo ? saveDataUrlImage(photo, 'proofs', `order-${bookingId.slice(0, 8)}`) : Promise.resolve(null));
const discardPhoto = (photoUrl) => (photoUrl ? fs.unlink(uploadedFilePath(photoUrl)).catch(() => {}) : null);

/** Shared checks for the driver's note / item count; returns an error message or null */
const invalidExtras = ({ note, itemCount }) => {
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 500)) return 'Note must be text of at most 500 characters';
  if (itemCount !== undefined && itemCount !== null && (!Number.isInteger(itemCount) || itemCount < 0 || itemCount > 1000)) return 'Item count must be a whole number';
  return null;
};

/**
 * PATCH /api/v1/drivers/orders/:id/status
 * Body: { status, note?, photo?, itemCount?, cashCollected?, receiverName? }
 * - status: picked_up | in_process (handed to store) | out_for_delivery | delivered
 * - receiverName: who took the clothes at the door (delivered); the delivery time is recorded too
 * - Delivering an order that is already delivered is refused (409).
 * - itemCount: pieces counted at pickup
 * - photo: proof (data URL)
 * - cashCollected: required to deliver an unpaid COD order. It must cover the amount due, and the order is then marked paid.
 * Every change is recorded in booking_events.
 */
const updateOrderStatus = async (req, res, next) => {
  const { status, note, photo, itemCount, cashCollected } = req.body;
  if (!DRIVER_STATUSES.includes(status)) {
    return sendError(res, 400, `Driver can only set: ${DRIVER_STATUSES.join(', ')}`);
  }
  const extrasError = invalidExtras({ note, itemCount });
  if (extrasError) return sendError(res, 422, extrasError);
  const receiverName = typeof req.body.receiverName === 'string' ? req.body.receiverName.trim().replace(/\s+/g, ' ') : '';
  if (receiverName.length > 100) return sendError(res, 422, 'Receiver name can be at most 100 characters');
  if (cashCollected !== undefined && cashCollected !== null && !(typeof cashCollected === 'number' && Number.isFinite(cashCollected) && cashCollected >= 0)) {
    return sendError(res, 422, 'Cash collected must be an amount in rupees');
  }
  if (!isUuid(req.params.id)) return sendError(res, 404, 'Booking not found or not assigned to you');

  let photoUrl = null;
  try {
    photoUrl = await savePhoto(photo, req.params.id);
  } catch (error) {
    return next(error);
  }

  const t = await sequelize.transaction();
  const fail = async (code, message) => {
    await t.rollback();
    await discardPhoto(photoUrl);
    return sendError(res, code, message);
  };
  try {
    // Lock the booking so a concurrent admin change or cancellation is seen before checking the transition
    const booking = await Booking.findOne({
      where: { id: req.params.id, driverId: req.user.id },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!booking) return fail(404, 'Booking not found or not assigned to you');

    const fromStatus = booking.status;
    if (status === 'delivered' && fromStatus === 'delivered') return fail(409, 'This order is already delivered');
    if (!canChangeStatus(fromStatus, status)) return fail(400, `Cannot change status from ${fromStatus} to ${status}`);
    // Staff can start processing clothes received at the shop; a driver hands over only what they picked up
    if (status === 'in_process' && !['picked_up', 'in_process'].includes(fromStatus)) return fail(400, 'Pick up the clothes before handing them to the store');
    const changed = fromStatus !== status;

    // D4: cash on delivery is collected at the door before the order can be delivered
    const due = status === 'delivered' && changed ? cashDue(booking) : 0;
    if (due > 0) {
      if (cashCollected === undefined || cashCollected === null) return fail(422, `Collect ₹${due} in cash and enter the amount before marking delivered`);
      if (Math.round(cashCollected * 100) < Math.round(due * 100)) return fail(422, `₹${due} is due for this order; ₹${cashCollected} is not enough`);
      booking.paymentStatus = 'paid';
    }

    booking.status = status;
    const delivering = status === 'delivered' && changed;
    if (delivering) {
      booking.deliveredAt = new Date();
      booking.receivedBy = receiverName || null;
    }
    await booking.save({ transaction: t });

    const event = { bookingId: booking.id, actorId: req.user.id };
    if (changed || note || photoUrl || itemCount !== undefined) {
      await BookingEvent.create({
        ...event, type: 'status', fromStatus, toStatus: status, note: note || null, photoUrl, itemCount: itemCount ?? null,
        ...(delivering ? { receiverName: receiverName || null, partnerId: req.user.id } : {}),
      }, { transaction: t });
    }
    if (due > 0) {
      await BookingEvent.create({ ...event, type: 'cash_collected', amount: cashCollected }, { transaction: t });
    }
    await t.commit();

    return sendSuccess(res, 200, 'Status updated', {
      id: booking.id,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      cashCollected: due > 0 ? cashCollected : 0,
      photoUrl,
    });
  } catch (error) {
    await t.rollback();
    await discardPhoto(photoUrl);
    next(error);
  }
};

/**
 * POST /api/v1/drivers/orders/:id/failed
 * D3: a pickup or delivery that couldn't be done. Body: { reason, note?, photo? }
 * - At the pickup stage the order keeps its status (the store reassigns or reschedules); a pickup_failed event is recorded.
 * - Out for delivery: the order goes back to ready; a delivery_failed event is recorded.
 */
const reportFailedAttempt = async (req, res, next) => {
  const { reason, note, photo } = req.body;
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 255) return sendError(res, 422, 'Choose why it could not be done');
  const extrasError = invalidExtras({ note });
  if (extrasError) return sendError(res, 422, extrasError);
  if (!isUuid(req.params.id)) return sendError(res, 404, 'Booking not found or not assigned to you');

  let photoUrl = null;
  try {
    photoUrl = await savePhoto(photo, req.params.id);
  } catch (error) {
    return next(error);
  }

  const t = await sequelize.transaction();
  const fail = async (code, message) => {
    await t.rollback();
    await discardPhoto(photoUrl);
    return sendError(res, code, message);
  };
  try {
    const booking = await Booking.findOne({
      where: { id: req.params.id, driverId: req.user.id },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!booking) return fail(404, 'Booking not found or not assigned to you');

    const fromStatus = booking.status;
    const atPickup = DRIVER_STAGES[fromStatus] === 'pickup';
    if (!atPickup && fromStatus !== 'out_for_delivery') {
      return fail(400, 'Only a pickup, or an order out for delivery, can be marked as not done');
    }

    const type = atPickup ? 'pickup_failed' : 'delivery_failed';
    if (!atPickup) {
      booking.status = 'ready'; // back to the store's Ready list for another delivery
      await booking.save({ transaction: t });
    }
    await BookingEvent.create({
      bookingId: booking.id,
      actorId: req.user.id,
      type,
      fromStatus,
      toStatus: booking.status,
      reason: reason.trim(),
      note: note || null,
      photoUrl,
    }, { transaction: t });
    await t.commit();

    return sendSuccess(res, 200, atPickup ? 'Pickup attempt recorded' : 'Delivery attempt recorded; the order is back to Ready', {
      id: booking.id,
      status: booking.status,
      type,
    });
  } catch (error) {
    await t.rollback();
    await discardPhoto(photoUrl);
    next(error);
  }
};

/**
 * GET /api/v1/driver/stats
 * Driver dashboard stats
 */
const getDriverStats = async (req, res, next) => {
  try {
    const driverId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const totalAssigned = await Booking.count({ where: { driverId } });
    const totalDelivered = await Booking.count({ where: { driverId, status: 'delivered' } });
    const activeOrders = await Booking.count({ where: { driverId, status: { [Op.notIn]: ['delivered', 'collected', 'cancelled'] } } });
    const todayOrders = await Booking.count({ where: { driverId, pickupDate: today } });

    return sendSuccess(res, 200, 'Stats fetched', {
      totalAssigned,
      totalDelivered,
      activeOrders,
      todayOrders,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Admin endpoints
  createDeliveryBoy, getDeliveryBoys, updateDeliveryBoy, deleteDeliveryBoy, assignDriverToBooking,
  // Driver endpoints
  driverSendOtp, driverVerifyOtp, driverResendOtp, driverLogin, getMyOrders, updateOrderStatus, reportFailedAttempt, getDriverStats,
};
