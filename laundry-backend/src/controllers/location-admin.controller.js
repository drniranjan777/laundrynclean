const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('../models/user.model');
const { Booking, TimeSlot } = require('../models/booking.model');
const { Category, Item } = require('../models/category.model');
const ServiceablePincode = require('../models/serviceable-pincode.model');
const { Location, LocationItemPrice, LocationTimeSlot } = require('../models/location.model');
const { sendSuccess, sendError } = require('../utils/response');
const { isUuid } = require('../utils/location-scope');

const CODE_PATTERN = /^[A-Z0-9]{2,10}$/;
const MANAGER_FIELDS = ['id', 'name', 'email', 'phone', 'isActive', 'lastLoginAt'];

const cleanCode = (value) => String(value || '').trim().toUpperCase();
const blankToNull = (value) => (value === undefined ? undefined : (String(value).trim() || null));

/** Location fields an admin can set (undefined = leave unchanged) */
const locationInput = (body) => ({
  name: body.name !== undefined ? String(body.name).trim() : undefined,
  addressLine: blankToNull(body.addressLine),
  city: blankToNull(body.city),
  state: blankToNull(body.state),
  pincode: blankToNull(body.pincode),
  phone: blankToNull(body.phone),
  email: blankToNull(body.email),
  gstin: body.gstin !== undefined ? (String(body.gstin).trim().toUpperCase() || null) : undefined,
  isActive: body.isActive,
  sortOrder: body.sortOrder !== undefined ? parseInt(body.sortOrder) || 0 : undefined,
});

const withoutUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

/** 409 message when the code or invoice prefix is taken by another location */
const findClash = async ({ code, invoicePrefix }, exceptId) => {
  const where = { [Op.or]: [] };
  if (code) where[Op.or].push({ code });
  if (invoicePrefix) where[Op.or].push({ invoicePrefix });
  if (where[Op.or].length === 0) return null;
  if (exceptId) where.id = { [Op.ne]: exceptId };
  const other = await Location.findOne({ where });
  if (!other) return null;
  return other.code === code ? `Code ${code} is already used by ${other.name}` : `Invoice prefix ${invoicePrefix} is already used by ${other.name}`;
};

const summarise = async (location) => {
  const [pincodes, drivers, orders, managers] = await Promise.all([
    ServiceablePincode.count({ where: { locationId: location.id } }),
    User.count({ where: { locationId: location.id, role: 'driver' } }),
    Booking.count({ where: { locationId: location.id } }),
    User.findAll({ where: { locationId: location.id, role: 'manager' }, attributes: MANAGER_FIELDS, order: [['name', 'ASC']] }),
  ]);
  return { ...location.toJSON(), counts: { pincodes, drivers, orders }, managers };
};

// ========== LOCATIONS ==========

/**
 * GET /api/v1/admin/locations
 * Admin: all locations. Branch manager: their own location only.
 */
const getLocations = async (req, res, next) => {
  try {
    const where = req.user.role === 'manager' ? { id: req.user.locationId } : {};
    const locations = await Location.findAll({ where, order: [['sortOrder', 'ASC'], ['name', 'ASC']] });
    return sendSuccess(res, 200, 'Locations fetched', await Promise.all(locations.map(summarise)));
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/locations
 */
const createLocation = async (req, res, next) => {
  try {
    const input = withoutUndefined(locationInput(req.body));
    const code = cleanCode(req.body.code);
    const invoicePrefix = cleanCode(req.body.invoicePrefix) || code;
    if (!input.name) return sendError(res, 422, 'Location name is required');
    if (!CODE_PATTERN.test(code)) return sendError(res, 422, 'Code must be 2-10 letters or digits, e.g. KRM');
    if (!CODE_PATTERN.test(invoicePrefix)) return sendError(res, 422, 'Invoice prefix must be 2-10 letters or digits');

    const clash = await findClash({ code, invoicePrefix });
    if (clash) return sendError(res, 409, clash);

    const location = await Location.create({ ...input, code, invoicePrefix, invoiceCounter: 0 });
    return sendSuccess(res, 201, 'Location created', await summarise(location));
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/admin/locations/:id
 */
const updateLocation = async (req, res, next) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) return sendError(res, 404, 'Location not found');

    const input = withoutUndefined(locationInput(req.body));
    if (input.name === '') return sendError(res, 422, 'Location name is required');
    if (req.body.code !== undefined) {
      input.code = cleanCode(req.body.code);
      if (!CODE_PATTERN.test(input.code)) return sendError(res, 422, 'Code must be 2-10 letters or digits, e.g. KRM');
    }
    if (req.body.invoicePrefix !== undefined) {
      input.invoicePrefix = cleanCode(req.body.invoicePrefix);
      if (!CODE_PATTERN.test(input.invoicePrefix)) return sendError(res, 422, 'Invoice prefix must be 2-10 letters or digits');
    }

    const clash = await findClash({ code: input.code, invoicePrefix: input.invoicePrefix }, location.id);
    if (clash) return sendError(res, 409, clash);

    await location.update(input);
    return sendSuccess(res, 200, 'Location updated', await summarise(location));
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/admin/locations/:id
 * Only for a location nothing points at yet; otherwise deactivate it.
 */
const deleteLocation = async (req, res, next) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) return sendError(res, 404, 'Location not found');

    const { counts, managers } = await summarise(location);
    if (counts.orders || counts.pincodes || counts.drivers || managers.length) {
      return sendError(res, 409, 'This location has orders, pincodes or staff. Deactivate it instead.');
    }
    await location.destroy();
    return sendSuccess(res, 200, 'Location deleted');
  } catch (error) {
    next(error);
  }
};

// ========== BRANCH MANAGERS ==========

/**
 * POST /api/v1/admin/locations/:id/managers
 * Create a branch manager login for a location
 */
const createManager = async (req, res, next) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) return sendError(res, 404, 'Location not found');

    const { name, email, phone, password } = req.body;
    if (!name || !email || !phone || !password) return sendError(res, 422, 'Name, email, phone and password are required');
    if (String(password).length < 8) return sendError(res, 422, 'Password must be at least 8 characters');

    const exists = await User.findOne({ where: { [Op.or]: [{ email }, { phone }] } });
    if (exists) return sendError(res, 409, 'A user with this email or phone already exists');

    const manager = await User.create({
      name,
      email,
      phone,
      password: await bcrypt.hash(password, 12),
      role: 'manager',
      locationId: location.id,
      isVerified: true,
      isActive: true,
      isProfileComplete: true,
    });
    return sendSuccess(res, 201, 'Manager created', Object.fromEntries(MANAGER_FIELDS.map(f => [f, manager[f]])));
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/admin/managers/:id
 * Edit, move, reset password, or (de)activate a branch manager
 */
const updateManager = async (req, res, next) => {
  try {
    const manager = await User.findOne({ where: { id: req.params.id, role: 'manager' } });
    if (!manager) return sendError(res, 404, 'Manager not found');

    const { name, email, phone, password, isActive, locationId } = req.body;
    if (email || phone) {
      const or = [];
      if (email) or.push({ email });
      if (phone) or.push({ phone });
      const clash = await User.findOne({ where: { [Op.or]: or, id: { [Op.ne]: manager.id } } });
      if (clash) return sendError(res, 409, 'A user with this email or phone already exists');
    }
    if (password !== undefined && password !== '' && String(password).length < 8) {
      return sendError(res, 422, 'Password must be at least 8 characters');
    }
    if (locationId !== undefined) {
      if (!isUuid(locationId) || !(await Location.findByPk(locationId))) return sendError(res, 404, 'Location not found');
      manager.locationId = locationId;
    }

    if (name) manager.name = name;
    if (email) manager.email = email;
    if (phone) manager.phone = phone;
    if (isActive !== undefined) manager.isActive = !!isActive;
    if (password) manager.password = await bcrypt.hash(password, 12);
    await manager.save();

    return sendSuccess(res, 200, 'Manager updated', Object.fromEntries(MANAGER_FIELDS.map(f => [f, manager[f]])));
  } catch (error) {
    next(error);
  }
};

// ========== PRICES PER LOCATION ==========

/**
 * GET /api/v1/admin/locations/:id/prices
 * Every catalogue item with its base price and this location's override
 */
const getLocationPrices = async (req, res, next) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) return sendError(res, 404, 'Location not found');

    const [items, overrides] = await Promise.all([
      Item.findAll({
        attributes: ['id', 'name', 'price', 'isActive', 'categoryId'],
        include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
        order: [['name', 'ASC']],
      }),
      LocationItemPrice.findAll({ where: { locationId: location.id } }),
    ]);
    const byItem = new Map(overrides.map(o => [o.itemId, o]));

    return sendSuccess(res, 200, 'Location prices fetched', {
      location: { id: location.id, name: location.name, code: location.code },
      items: items.map((item) => {
        const override = byItem.get(item.id);
        return {
          itemId: item.id,
          name: item.name,
          category: item.category?.name || null,
          isActive: item.isActive,
          basePrice: parseFloat(item.price),
          price: override?.price !== null && override?.price !== undefined ? parseFloat(override.price) : null,
          isAvailable: override ? override.isAvailable : true,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/admin/locations/:id/prices
 * Body: { prices: [{ itemId, price: number|null, isAvailable: boolean }] }
 * price null = use the base price. A row with neither override is removed.
 */
const updateLocationPrices = async (req, res, next) => {
  const { prices } = req.body;
  if (!Array.isArray(prices)) return sendError(res, 422, 'prices must be a list');
  for (const p of prices) {
    if (!isUuid(p.itemId)) return sendError(res, 422, 'Each price needs a valid itemId');
    if (p.price !== null && p.price !== undefined && p.price !== '' && !(parseFloat(p.price) >= 0)) {
      return sendError(res, 422, 'Prices must be 0 or more');
    }
  }

  const t = await sequelize.transaction();
  try {
    const location = await Location.findByPk(req.params.id, { transaction: t });
    if (!location) { await t.rollback(); return sendError(res, 404, 'Location not found'); }

    for (const p of prices) {
      const price = p.price === null || p.price === undefined || p.price === '' ? null : Math.round(parseFloat(p.price) * 100) / 100;
      const isAvailable = p.isAvailable !== false;
      if (price === null && isAvailable) {
        await LocationItemPrice.destroy({ where: { locationId: location.id, itemId: p.itemId }, transaction: t });
      } else {
        const [row, created] = await LocationItemPrice.findOrCreate({
          where: { locationId: location.id, itemId: p.itemId },
          defaults: { locationId: location.id, itemId: p.itemId, price, isAvailable },
          transaction: t,
        });
        if (!created) await row.update({ price, isAvailable }, { transaction: t });
      }
    }

    await t.commit();
    return sendSuccess(res, 200, 'Prices saved', { updated: prices.length });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// ========== PICKUP SLOT CAPACITY PER LOCATION ==========

/**
 * GET /api/v1/admin/locations/:id/time-slots
 * Every time slot with its default capacity and this location's own capacity (null = default)
 */
const getLocationTimeSlots = async (req, res, next) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) return sendError(res, 404, 'Location not found');

    const [slots, own] = await Promise.all([
      TimeSlot.findAll({ order: [['sortOrder', 'ASC']] }),
      LocationTimeSlot.findAll({ where: { locationId: location.id } }),
    ]);
    const bySlot = new Map(own.map(o => [o.timeSlotId, o.maxBookings]));

    return sendSuccess(res, 200, 'Location time slots fetched', {
      location: { id: location.id, name: location.name, code: location.code },
      slots: slots.map(slot => ({
        timeSlotId: slot.id,
        label: slot.label,
        isActive: slot.isActive,
        baseMaxBookings: slot.maxBookings,
        maxBookings: bySlot.has(slot.id) ? bySlot.get(slot.id) : null,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/admin/locations/:id/time-slots
 * Body: { slots: [{ timeSlotId, maxBookings: number|null }] }
 * maxBookings is orders per day at this location (0 closes the slot here); null = the slot's default.
 */
const updateLocationTimeSlots = async (req, res, next) => {
  const { slots } = req.body;
  if (!Array.isArray(slots)) return sendError(res, 422, 'slots must be a list');
  const isDefault = (v) => v === null || v === undefined || v === '';
  const isCapacity = (v) => ['number', 'string'].includes(typeof v) && Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 10000;
  for (const s of slots) {
    if (!isUuid(s.timeSlotId)) return sendError(res, 422, 'Each slot needs a valid timeSlotId');
    if (!isDefault(s.maxBookings) && !isCapacity(s.maxBookings)) {
      return sendError(res, 422, 'Capacity must be a whole number from 0 to 10000');
    }
  }

  const t = await sequelize.transaction();
  try {
    const location = await Location.findByPk(req.params.id, { transaction: t });
    if (!location) { await t.rollback(); return sendError(res, 404, 'Location not found'); }
    const slotIds = [...new Set(slots.map(s => s.timeSlotId))];
    if (await TimeSlot.count({ where: { id: slotIds }, transaction: t }) !== slotIds.length) {
      await t.rollback();
      return sendError(res, 404, 'Time slot not found');
    }

    for (const s of slots) {
      const where = { locationId: location.id, timeSlotId: s.timeSlotId };
      if (isDefault(s.maxBookings)) {
        await LocationTimeSlot.destroy({ where, transaction: t });
      } else {
        const maxBookings = Number(s.maxBookings);
        const [row, created] = await LocationTimeSlot.findOrCreate({ where, defaults: { ...where, maxBookings }, transaction: t });
        if (!created) await row.update({ maxBookings }, { transaction: t });
      }
    }

    await t.commit();
    return sendSuccess(res, 200, 'Slot capacity saved', { updated: slots.length });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// ========== ORDERS ==========

/**
 * PATCH /api/v1/admin/bookings/:id/location
 * Move an online order to another location (store bills stay with the store that billed them)
 */
const moveBooking = async (req, res, next) => {
  const { locationId } = req.body;
  if (!isUuid(locationId)) return sendError(res, 422, 'Choose a location');

  const t = await sequelize.transaction();
  try {
    const booking = await Booking.findByPk(req.params.id, { lock: t.LOCK.UPDATE, transaction: t });
    if (!booking) { await t.rollback(); return sendError(res, 404, 'Booking not found'); }
    if (booking.orderType === 'offline') {
      await t.rollback();
      return sendError(res, 400, 'Store orders stay with the location that billed them');
    }
    const location = await Location.findOne({ where: { id: locationId, isActive: true }, transaction: t });
    if (!location) { await t.rollback(); return sendError(res, 404, 'Location not found or inactive'); }

    booking.locationId = location.id;
    // A delivery boy from the old location can't keep the order
    if (booking.driverId) {
      const driver = await User.findByPk(booking.driverId, { transaction: t });
      if (driver?.locationId && driver.locationId !== location.id) booking.driverId = null;
    }
    await booking.save({ transaction: t });
    await t.commit();

    return sendSuccess(res, 200, `Order moved to ${location.name}`, {
      id: booking.id,
      locationId: booking.locationId,
      driverId: booking.driverId,
      location: { id: location.id, name: location.name, code: location.code },
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

module.exports = {
  getLocations, createLocation, updateLocation, deleteLocation,
  createManager, updateManager,
  getLocationPrices, updateLocationPrices,
  getLocationTimeSlots, updateLocationTimeSlots,
  moveBooking,
};
