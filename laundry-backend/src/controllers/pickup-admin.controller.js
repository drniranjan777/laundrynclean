const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const { TimeSlot, Booking, BookingItem } = require('../models/booking.model');
const { Location, LocationTimeSlot } = require('../models/location.model');
const { Item } = require('../models/category.model');
const BookingEvent = require('../models/booking-event.model');
const User = require('../models/user.model');
const { PickupSettings, PickupDateException, SlotDateOverride, DeliveryChargeRule, AdminAuditLog } = require('../models/pickup.model');
const { sendSuccess, sendError } = require('../utils/response');
const { isUuid, canAccessLocation, scopedLocationId } = require('../utils/location-scope');
const { getSettings, isDay, dayIn } = require('../services/pickup-availability.service');
const { ruleFor, chargesFor, summarise, money } = require('../services/delivery-charge.service');
const { getPriceOverrides, priceAt } = require('../services/location.service');
const { memberBenefits, memberDiscountOn } = require('../services/subscription.service');
const { audit } = require('../services/audit.service');

/**
 * Admin side of Schedule Pickup: settings, dates, time slots, delivery charge rules, per-store pickup settings,
 * billing bulk pickups after they are counted, and the audit log. Writes are admin-only (routes); branch managers
 * can read and bill their own store's pickups.
 */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const label12 = (t) => {
  const h = Number(t.slice(0, 2));
  return `${String(h % 12 === 0 ? 12 : h % 12).padStart(2, '0')}:${t.slice(3, 5)} ${h < 12 ? 'AM' : 'PM'}`;
};
const cleanDays = (days) => (Array.isArray(days) ? [...new Set(days.map(Number))].filter(d => Number.isInteger(d) && d >= 0 && d <= 6).sort() : null);
const isTimezone = (tz) => {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
};
const text = (v) => (typeof v === 'string' ? v.trim() : '');

// ===== Settings =====

/** GET /api/v1/admin/pickup/settings */
const getPickupSettings = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const today = dayIn(new Date(), settings.timezone);
    return sendSuccess(res, 200, 'Pickup settings fetched', { ...settings, today });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/admin/pickup/settings
 * Body (any of): { enabled, bulkEnabled, minAdvanceDays (≥1), maxAdvanceDays (≤90), timezone, workingDays [0-6], instructions, policies }
 */
const updatePickupSettings = async (req, res, next) => {
  const b = req.body || {};
  const changes = {};
  if (b.enabled !== undefined) changes.enabled = !!b.enabled;
  if (b.bulkEnabled !== undefined) changes.bulkEnabled = !!b.bulkEnabled;
  if (b.minAdvanceDays !== undefined) {
    if (!Number.isInteger(Number(b.minAdvanceDays)) || Number(b.minAdvanceDays) < 1 || Number(b.minAdvanceDays) > 30) return sendError(res, 422, 'Minimum advance must be 1 to 30 days (same-day pickup is never allowed)');
    changes.minAdvanceDays = Number(b.minAdvanceDays);
  }
  if (b.maxAdvanceDays !== undefined) {
    if (!Number.isInteger(Number(b.maxAdvanceDays)) || Number(b.maxAdvanceDays) < 1 || Number(b.maxAdvanceDays) > 90) return sendError(res, 422, 'Maximum advance must be 1 to 90 days');
    changes.maxAdvanceDays = Number(b.maxAdvanceDays);
  }
  if (b.timezone !== undefined) {
    if (!isTimezone(b.timezone)) return sendError(res, 422, 'Unknown timezone');
    changes.timezone = b.timezone;
  }
  if (b.workingDays !== undefined) {
    const days = cleanDays(b.workingDays);
    if (!days || days.length === 0) return sendError(res, 422, 'Choose at least one working day');
    changes.workingDays = days;
  }
  if (b.instructions !== undefined) changes.instructions = text(b.instructions).slice(0, 2000) || null;
  if (b.policies !== undefined) changes.policies = text(b.policies).slice(0, 4000) || null;

  const t = await sequelize.transaction();
  try {
    const [row] = await PickupSettings.findOrCreate({ where: { id: 1 }, defaults: { id: 1 }, transaction: t, lock: t.LOCK.UPDATE });
    const before = row.toJSON();
    const min = changes.minAdvanceDays ?? row.minAdvanceDays;
    const max = changes.maxAdvanceDays ?? row.maxAdvanceDays;
    if (max < min) { await t.rollback(); return sendError(res, 422, 'Maximum advance days must be at least the minimum'); }
    await row.update({ ...changes, updatedBy: req.user.id }, { transaction: t });
    await audit(req, { action: 'settings.update', entity: 'pickup_settings', entityId: 1, before, after: row }, t);
    await t.commit();
    return sendSuccess(res, 200, 'Pickup settings saved', await getSettings());
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// ===== Time slots =====

/** Slot as the admin panel shows it, with per-store capacities */
const slotJson = (slot) => {
  const j = slot.toJSON();
  return {
    id: j.id,
    label: j.label,
    startTime: j.startTime,
    endTime: j.endTime,
    maxBookings: j.maxBookings,
    days: (j.days || []).map(Number),
    allLocations: j.allLocations,
    isActive: j.isActive,
    sortOrder: j.sortOrder,
    locations: (j.locationCapacities || []).map(c => ({ locationId: c.locationId, maxBookings: c.maxBookings })),
  };
};

/** GET /api/v1/admin/pickup/slots — all slots, with upcoming (not cancelled) bookings per slot */
const listSlotsAdmin = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const today = dayIn(new Date(), settings.timezone);
    const slots = await TimeSlot.findAll({ include: [{ model: LocationTimeSlot, as: 'locationCapacities' }], order: [['sortOrder', 'ASC'], ['startTime', 'ASC']] });
    const upcoming = await Booking.findAll({
      where: { pickupDate: { [Op.gte]: today }, status: { [Op.notIn]: ['cancelled'] }, ...(scopedLocationId(req) ? { locationId: scopedLocationId(req) } : {}) },
      attributes: ['timeSlotId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['timeSlotId'],
      raw: true,
    });
    const counts = new Map(upcoming.map(u => [u.timeSlotId, Number(u.count)]));
    return sendSuccess(res, 200, 'Time slots fetched', slots.map(s => ({ ...slotJson(s), upcomingBookings: counts.get(s.id) || 0 })));
  } catch (error) {
    next(error);
  }
};

/** Shared checks for creating / editing a slot. Returns { values } or { error }. */
const slotInput = (body, existing) => {
  const startTime = body.startTime ?? existing?.startTime;
  const endTime = body.endTime ?? existing?.endTime;
  if (!TIME.test(startTime || '') || !TIME.test(endTime || '')) return { error: 'Times must be HH:MM (24-hour)' };
  if (toMinutes(startTime) >= toMinutes(endTime)) return { error: 'The start time must be before the end time (slots can\'t cross midnight)' };
  const maxBookings = body.maxBookings ?? existing?.maxBookings ?? 20;
  if (!Number.isInteger(Number(maxBookings)) || Number(maxBookings) < 0 || Number(maxBookings) > 10000) return { error: 'Capacity must be a whole number from 0 to 10000' };
  const days = body.days !== undefined ? cleanDays(body.days) : (existing?.days || [0, 1, 2, 3, 4, 5, 6]).map(Number);
  if (!days || days.length === 0) return { error: 'Choose at least one day for the slot' };
  const label = text(body.label) || (existing && !body.startTime && !body.endTime ? existing.label : `${label12(startTime)} - ${label12(endTime)}`);
  return {
    values: {
      label: label.slice(0, 60),
      startTime,
      endTime,
      maxBookings: Number(maxBookings),
      days,
      allLocations: body.allLocations !== undefined ? !!body.allLocations : (existing?.allLocations ?? true),
      isActive: body.isActive !== undefined ? !!body.isActive : (existing?.isActive ?? true),
      sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) || 0 : (existing?.sortOrder ?? toMinutes(startTime)),
    },
  };
};

/** Another active slot that overlaps in time on a shared day, or null */
const overlapping = async (values, exceptId, transaction) => {
  if (!values.isActive) return null;
  const others = await TimeSlot.findAll({ where: { isActive: true, ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}) }, transaction });
  return others.find(o => (o.days || []).map(Number).some(d => values.days.includes(d))
    && toMinutes(o.startTime) < toMinutes(values.endTime) && toMinutes(values.startTime) < toMinutes(o.endTime)) || null;
};

/** Saves the per-store capacities sent with a slot: [{ locationId, maxBookings }] (null removes the store's own number) */
const saveSlotLocations = async (slotId, locations, transaction) => {
  if (!Array.isArray(locations)) return null;
  for (const l of locations) {
    if (!isUuid(l.locationId)) return 'Each store needs a valid id';
    if (l.maxBookings !== null && l.maxBookings !== undefined && l.maxBookings !== ''
      && (!Number.isInteger(Number(l.maxBookings)) || Number(l.maxBookings) < 0 || Number(l.maxBookings) > 10000)) return 'Store capacity must be a whole number from 0 to 10000';
  }
  for (const l of locations) {
    const where = { locationId: l.locationId, timeSlotId: slotId };
    if (l.maxBookings === null || l.maxBookings === undefined || l.maxBookings === '') {
      await LocationTimeSlot.destroy({ where, transaction });
    } else {
      const [row, created] = await LocationTimeSlot.findOrCreate({ where, defaults: { ...where, maxBookings: Number(l.maxBookings) }, transaction });
      if (!created) await row.update({ maxBookings: Number(l.maxBookings) }, { transaction });
    }
  }
  return null;
};

/**
 * POST /api/v1/admin/pickup/slots
 * Body: { label?, startTime 'HH:MM', endTime, maxBookings, days [0-6], allLocations, isActive, sortOrder?, locations?, allowOverlap? }
 * Overlapping active slots on the same day are refused unless allowOverlap is true.
 */
const createSlot = async (req, res, next) => {
  const { values, error } = slotInput(req.body || {});
  if (error) return sendError(res, 422, error);
  const t = await sequelize.transaction();
  try {
    const clash = await overlapping(values, null, t);
    if (clash && !req.body.allowOverlap) { await t.rollback(); return sendError(res, 409, `Overlaps "${clash.label}" on the same day. Change the times, or save anyway to allow the overlap.`); }
    const slot = await TimeSlot.create(values, { transaction: t });
    const locError = await saveSlotLocations(slot.id, req.body.locations, t);
    if (locError) { await t.rollback(); return sendError(res, 422, locError); }
    await audit(req, { action: 'slot.create', entity: 'time_slot', entityId: slot.id, after: slot }, t);
    await t.commit();
    const saved = await TimeSlot.findByPk(slot.id, { include: [{ model: LocationTimeSlot, as: 'locationCapacities' }] });
    return sendSuccess(res, 201, 'Time slot created', slotJson(saved));
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

/** PUT /api/v1/admin/pickup/slots/:id — same body as create; booked orders keep their slot */
const updateSlot = async (req, res, next) => {
  if (!isUuid(req.params.id)) return sendError(res, 404, 'Time slot not found');
  const t = await sequelize.transaction();
  try {
    const slot = await TimeSlot.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!slot) { await t.rollback(); return sendError(res, 404, 'Time slot not found'); }
    const { values, error } = slotInput(req.body || {}, slot);
    if (error) { await t.rollback(); return sendError(res, 422, error); }
    const clash = await overlapping(values, slot.id, t);
    if (clash && !req.body.allowOverlap) { await t.rollback(); return sendError(res, 409, `Overlaps "${clash.label}" on the same day. Change the times, or save anyway to allow the overlap.`); }
    const before = slot.toJSON();
    await slot.update(values, { transaction: t });
    const locError = await saveSlotLocations(slot.id, req.body.locations, t);
    if (locError) { await t.rollback(); return sendError(res, 422, locError); }
    await audit(req, { action: 'slot.update', entity: 'time_slot', entityId: slot.id, before, after: slot }, t);
    await t.commit();
    const saved = await TimeSlot.findByPk(slot.id, { include: [{ model: LocationTimeSlot, as: 'locationCapacities' }] });
    return sendSuccess(res, 200, 'Time slot saved', slotJson(saved));
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

/** DELETE /api/v1/admin/pickup/slots/:id — only a slot no order has used; otherwise disable it */
const deleteSlot = async (req, res, next) => {
  if (!isUuid(req.params.id)) return sendError(res, 404, 'Time slot not found');
  const t = await sequelize.transaction();
  try {
    const slot = await TimeSlot.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!slot) { await t.rollback(); return sendError(res, 404, 'Time slot not found'); }
    const used = await Booking.count({ where: { timeSlotId: slot.id }, transaction: t });
    if (used > 0) { await t.rollback(); return sendError(res, 409, `${used} order${used === 1 ? ' has' : 's have'} used this slot, so it can't be deleted. Disable it instead.`); }
    await audit(req, { action: 'slot.delete', entity: 'time_slot', entityId: slot.id, before: slot }, t);
    await slot.destroy({ transaction: t });
    await t.commit();
    return sendSuccess(res, 200, 'Time slot deleted');
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// ===== Date-specific slot capacity =====

/** GET /api/v1/admin/pickup/slot-overrides?from=&to= (default: from today) */
const listSlotOverrides = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const from = isDay(req.query.from) ? req.query.from : dayIn(new Date(), settings.timezone);
    const where = { date: { [Op.gte]: from, ...(isDay(req.query.to) ? { [Op.lte]: req.query.to } : {}) } };
    const rows = await SlotDateOverride.findAll({
      where,
      include: [{ model: TimeSlot, as: 'timeSlot', attributes: ['id', 'label'] }, { model: Location, as: 'location', attributes: ['id', 'name'] }],
      order: [['date', 'ASC']],
    });
    return sendSuccess(res, 200, 'Slot date overrides fetched', rows);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/admin/pickup/slot-overrides
 * Body: { timeSlotId, date, locationId?, maxBookings (0 = closed / full), reason? } — creates or replaces the override
 */
const saveSlotOverride = async (req, res, next) => {
  const { timeSlotId, date, locationId, maxBookings } = req.body || {};
  if (!isUuid(timeSlotId)) return sendError(res, 422, 'Choose a time slot');
  if (!isDay(date)) return sendError(res, 422, 'Choose a date');
  if (locationId && !isUuid(locationId)) return sendError(res, 422, 'Invalid store');
  if (!Number.isInteger(Number(maxBookings)) || Number(maxBookings) < 0 || Number(maxBookings) > 10000) return sendError(res, 422, 'Capacity must be a whole number from 0 to 10000 (0 closes the slot that day)');
  const t = await sequelize.transaction();
  try {
    if (!(await TimeSlot.findByPk(timeSlotId, { transaction: t }))) { await t.rollback(); return sendError(res, 404, 'Time slot not found'); }
    const where = { timeSlotId, date, locationId: locationId || null };
    const existing = await SlotDateOverride.findOne({ where, transaction: t });
    const before = existing ? existing.toJSON() : null;
    const values = { ...where, maxBookings: Number(maxBookings), reason: text(req.body.reason).slice(0, 255) || null, createdBy: req.user.id };
    const row = existing ? await existing.update(values, { transaction: t }) : await SlotDateOverride.create(values, { transaction: t });
    await audit(req, { action: existing ? 'slot_override.update' : 'slot_override.create', entity: 'slot_override', entityId: row.id, before, after: row }, t);
    await t.commit();
    return sendSuccess(res, existing ? 200 : 201, 'Slot capacity for the date saved', row);
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/** DELETE /api/v1/admin/pickup/slot-overrides/:id */
const deleteSlotOverride = async (req, res, next) => {
  if (!isUuid(req.params.id)) return sendError(res, 404, 'Not found');
  const t = await sequelize.transaction();
  try {
    const row = await SlotDateOverride.findByPk(req.params.id, { transaction: t });
    if (!row) { await t.rollback(); return sendError(res, 404, 'Not found'); }
    await audit(req, { action: 'slot_override.delete', entity: 'slot_override', entityId: row.id, before: row }, t);
    await row.destroy({ transaction: t });
    await t.commit();
    return sendSuccess(res, 200, 'Override removed');
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// ===== Date exceptions (holidays, blocked dates, extra open days) =====

/** GET /api/v1/admin/pickup/date-exceptions?from=&to= (default: from today) */
const listDateExceptions = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const from = isDay(req.query.from) ? req.query.from : dayIn(new Date(), settings.timezone);
    const rows = await PickupDateException.findAll({
      where: { date: { [Op.gte]: from, ...(isDay(req.query.to) ? { [Op.lte]: req.query.to } : {}) } },
      include: [{ model: Location, as: 'location', attributes: ['id', 'name'] }],
      order: [['date', 'ASC']],
    });
    return sendSuccess(res, 200, 'Date exceptions fetched', rows);
  } catch (error) {
    next(error);
  }
};

/** PUT /api/v1/admin/pickup/date-exceptions  Body: { date, locationId?, isOpen (false = closed), reason? } — creates or replaces */
const saveDateException = async (req, res, next) => {
  const { date, locationId } = req.body || {};
  if (!isDay(date)) return sendError(res, 422, 'Choose a date');
  if (locationId && !isUuid(locationId)) return sendError(res, 422, 'Invalid store');
  const t = await sequelize.transaction();
  try {
    const where = { date, locationId: locationId || null };
    const existing = await PickupDateException.findOne({ where, transaction: t });
    const before = existing ? existing.toJSON() : null;
    const values = { ...where, isOpen: !!req.body.isOpen, reason: text(req.body.reason).slice(0, 255) || null, createdBy: req.user.id };
    const row = existing ? await existing.update(values, { transaction: t }) : await PickupDateException.create(values, { transaction: t });
    await audit(req, { action: existing ? 'date_exception.update' : 'date_exception.create', entity: 'date_exception', entityId: row.id, before, after: row }, t);
    await t.commit();
    return sendSuccess(res, existing ? 200 : 201, row.isOpen ? 'Date opened for pickups' : 'Date closed for pickups', row);
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/** DELETE /api/v1/admin/pickup/date-exceptions/:id */
const deleteDateException = async (req, res, next) => {
  if (!isUuid(req.params.id)) return sendError(res, 404, 'Not found');
  const t = await sequelize.transaction();
  try {
    const row = await PickupDateException.findByPk(req.params.id, { transaction: t });
    if (!row) { await t.rollback(); return sendError(res, 404, 'Not found'); }
    await audit(req, { action: 'date_exception.delete', entity: 'date_exception', entityId: row.id, before: row }, t);
    await row.destroy({ transaction: t });
    await t.commit();
    return sendSuccess(res, 200, 'Date exception removed');
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// ===== Delivery charge rules =====

/** GET /api/v1/admin/pickup/delivery-charges — all rules, and which one applies today per store */
const listChargeRules = async (req, res, next) => {
  try {
    const rules = await DeliveryChargeRule.findAll({ include: [{ model: Location, as: 'location', attributes: ['id', 'name'] }], order: [['location_id', 'ASC NULLS FIRST'], ['effectiveFrom', 'ASC NULLS FIRST']] });
    const locations = await Location.findAll({ where: { isActive: true }, attributes: ['id', 'name'], order: [['sortOrder', 'ASC']] });
    const applying = await Promise.all(locations.map(async (l) => ({ locationId: l.id, name: l.name, rule: summarise(await ruleFor(l.id)) })));
    return sendSuccess(res, 200, 'Delivery charge rules fetched', { rules, applying });
  } catch (error) {
    next(error);
  }
};

/** Shared checks for a rule; returns { values } or { error } */
const ruleInput = (b, existing) => {
  const num = (v, fallback) => (v === undefined ? fallback : v === null || v === '' ? null : Number(v));
  const values = {
    name: text(b.name) || existing?.name || '',
    locationId: b.locationId !== undefined ? (b.locationId || null) : (existing?.locationId ?? null),
    freeAbove: num(b.freeAbove, existing ? Number(existing.freeAbove) : 250),
    minItemsFree: num(b.minItemsFree, existing ? existing.minItemsFree : null),
    deliveryCharge: num(b.deliveryCharge, existing ? Number(existing.deliveryCharge) : 50),
    pickupCharge: num(b.pickupCharge, existing ? Number(existing.pickupCharge) : 0) ?? 0,
    effectiveFrom: b.effectiveFrom !== undefined ? (b.effectiveFrom || null) : (existing?.effectiveFrom ?? null),
    effectiveTo: b.effectiveTo !== undefined ? (b.effectiveTo || null) : (existing?.effectiveTo ?? null),
    isActive: b.isActive !== undefined ? !!b.isActive : (existing?.isActive ?? true),
  };
  if (!values.name) return { error: 'Give the rule a name' };
  if (values.locationId && !isUuid(values.locationId)) return { error: 'Invalid store' };
  for (const [k, labelText] of [['freeAbove', 'Free delivery threshold'], ['deliveryCharge', 'Delivery charge'], ['pickupCharge', 'Pickup charge']]) {
    if (values[k] === null || !Number.isFinite(values[k]) || values[k] < 0 || values[k] > 100000) return { error: `${labelText} must be an amount from 0 to 100000` };
  }
  if (values.minItemsFree !== null && (!Number.isInteger(values.minItemsFree) || values.minItemsFree < 0 || values.minItemsFree > 10000)) return { error: 'Minimum items must be a whole number' };
  if ((values.effectiveFrom && !isDay(values.effectiveFrom)) || (values.effectiveTo && !isDay(values.effectiveTo))) return { error: 'Dates must be YYYY-MM-DD' };
  if (values.effectiveFrom && values.effectiveTo && values.effectiveTo < values.effectiveFrom) return { error: 'The end date must be after the start date' };
  return { values };
};

/** An active rule for the same store whose dates overlap, or null (so two rules never apply at once) */
const overlappingRule = async (values, exceptId, transaction) => {
  if (!values.isActive) return null;
  const others = await DeliveryChargeRule.findAll({ where: { isActive: true, locationId: values.locationId, ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}) }, transaction });
  const start = values.effectiveFrom || '0000-01-01';
  const end = values.effectiveTo || '9999-12-31';
  return others.find(o => (o.effectiveFrom || '0000-01-01') <= end && start <= (o.effectiveTo || '9999-12-31')) || null;
};

/** POST /api/v1/admin/pickup/delivery-charges */
const createChargeRule = async (req, res, next) => {
  const { values, error } = ruleInput(req.body || {});
  if (error) return sendError(res, 422, error);
  const t = await sequelize.transaction();
  try {
    if (values.locationId && !(await Location.findByPk(values.locationId, { transaction: t }))) { await t.rollback(); return sendError(res, 404, 'Store not found'); }
    const clash = await overlappingRule(values, null, t);
    if (clash) { await t.rollback(); return sendError(res, 409, `Overlaps the active rule "${clash.name}" for the same ${values.locationId ? 'store' : 'default'} and dates. Change its dates or deactivate it first.`); }
    const rule = await DeliveryChargeRule.create(values, { transaction: t });
    await audit(req, { action: 'charge_rule.create', entity: 'delivery_charge_rule', entityId: rule.id, after: rule }, t);
    await t.commit();
    return sendSuccess(res, 201, 'Delivery charge rule created', rule);
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

/** PUT /api/v1/admin/pickup/delivery-charges/:id */
const updateChargeRule = async (req, res, next) => {
  if (!isUuid(req.params.id)) return sendError(res, 404, 'Rule not found');
  const t = await sequelize.transaction();
  try {
    const rule = await DeliveryChargeRule.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!rule) { await t.rollback(); return sendError(res, 404, 'Rule not found'); }
    const { values, error } = ruleInput(req.body || {}, rule);
    if (error) { await t.rollback(); return sendError(res, 422, error); }
    const clash = await overlappingRule(values, rule.id, t);
    if (clash) { await t.rollback(); return sendError(res, 409, `Overlaps the active rule "${clash.name}" for the same ${values.locationId ? 'store' : 'default'} and dates. Change its dates or deactivate it first.`); }
    if (!values.locationId && !values.isActive && rule.isActive) {
      const otherDefaults = await DeliveryChargeRule.count({ where: { locationId: null, isActive: true, id: { [Op.ne]: rule.id } }, transaction: t });
      if (otherDefaults === 0) { await t.rollback(); return sendError(res, 409, 'Keep at least one active default rule; it applies to every store without its own.'); }
    }
    const before = rule.toJSON();
    await rule.update(values, { transaction: t });
    await audit(req, { action: 'charge_rule.update', entity: 'delivery_charge_rule', entityId: rule.id, before, after: rule }, t);
    await t.commit();
    return sendSuccess(res, 200, 'Delivery charge rule saved', rule);
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

/** DELETE /api/v1/admin/pickup/delivery-charges/:id — the last active default rule can't be removed */
const deleteChargeRule = async (req, res, next) => {
  if (!isUuid(req.params.id)) return sendError(res, 404, 'Rule not found');
  const t = await sequelize.transaction();
  try {
    const rule = await DeliveryChargeRule.findByPk(req.params.id, { transaction: t });
    if (!rule) { await t.rollback(); return sendError(res, 404, 'Rule not found'); }
    if (!rule.locationId && rule.isActive) {
      const otherDefaults = await DeliveryChargeRule.count({ where: { locationId: null, isActive: true, id: { [Op.ne]: rule.id } }, transaction: t });
      if (otherDefaults === 0) { await t.rollback(); return sendError(res, 409, 'This is the only active default rule. Edit it instead of deleting it.'); }
    }
    await audit(req, { action: 'charge_rule.delete', entity: 'delivery_charge_rule', entityId: rule.id, before: rule }, t);
    await rule.destroy({ transaction: t });
    await t.commit();
    return sendSuccess(res, 200, 'Delivery charge rule deleted');
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// ===== Per-store pickup settings =====

/** GET /api/v1/admin/pickup/locations — stores with their pickup switch, booking window, partners and slot capacities */
const listPickupLocations = async (req, res, next) => {
  try {
    const scoped = scopedLocationId(req);
    const locations = await Location.findAll({ where: scoped ? { id: scoped } : {}, order: [['sortOrder', 'ASC']] });
    const out = await Promise.all(locations.map(async (l) => ({
      id: l.id,
      name: l.name,
      code: l.code,
      isActive: l.isActive,
      pickupEnabled: l.pickupEnabled,
      maxAdvanceDays: l.maxAdvanceDays,
      partners: await User.count({ where: { role: 'driver', locationId: l.id, isActive: true } }),
      charges: summarise(await ruleFor(l.id)),
    })));
    return sendSuccess(res, 200, 'Pickup locations fetched', out);
  } catch (error) {
    next(error);
  }
};

/** PUT /api/v1/admin/pickup/locations/:id  Body: { pickupEnabled?, maxAdvanceDays? (null = global) } */
const updatePickupLocation = async (req, res, next) => {
  if (!isUuid(req.params.id)) return sendError(res, 404, 'Store not found');
  const b = req.body || {};
  const changes = {};
  if (b.pickupEnabled !== undefined) changes.pickupEnabled = !!b.pickupEnabled;
  if (b.maxAdvanceDays !== undefined) {
    if (b.maxAdvanceDays === null || b.maxAdvanceDays === '') changes.maxAdvanceDays = null;
    else if (!Number.isInteger(Number(b.maxAdvanceDays)) || Number(b.maxAdvanceDays) < 1 || Number(b.maxAdvanceDays) > 90) return sendError(res, 422, 'Booking window must be 1 to 90 days');
    else changes.maxAdvanceDays = Number(b.maxAdvanceDays);
  }
  const t = await sequelize.transaction();
  try {
    const location = await Location.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!location) { await t.rollback(); return sendError(res, 404, 'Store not found'); }
    const before = { pickupEnabled: location.pickupEnabled, maxAdvanceDays: location.maxAdvanceDays };
    await location.update(changes, { transaction: t });
    await audit(req, { action: 'location.pickup_update', entity: 'location', entityId: location.id, before, after: { pickupEnabled: location.pickupEnabled, maxAdvanceDays: location.maxAdvanceDays } }, t);
    await t.commit();
    return sendSuccess(res, 200, 'Store pickup settings saved', { id: location.id, pickupEnabled: location.pickupEnabled, maxAdvanceDays: location.maxAdvanceDays });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// ===== Billing a bulk pickup =====

const BILLABLE = ['picked_up', 'in_process', 'ready'];

/**
 * PUT /api/v1/admin/bookings/:id/bill
 * Body: { items: [{ itemId?, name?, quantity, price? }] } — the counted clothes of a bulk pickup.
 * Catalogue items are priced at the store's price; custom lines need a name and price. Pickup & delivery charges
 * come from the store's rule and the customer's plan (free delivery, member discount) at the time of billing.
 * Replaces any earlier bill. Not allowed once the order is paid, handed over or cancelled.
 */
const billBooking = async (req, res, next) => {
  if (!isUuid(req.params.id)) return sendError(res, 404, 'Booking not found');
  const lines = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!lines || lines.length === 0) return sendError(res, 422, 'Add at least one item');
  for (const l of lines) {
    if (!Number.isInteger(Number(l.quantity)) || Number(l.quantity) < 1 || Number(l.quantity) > 1000) return sendError(res, 422, 'Each item needs a quantity from 1 to 1000');
    if (l.itemId && !isUuid(l.itemId)) return sendError(res, 422, 'Invalid item');
    if (!l.itemId && (!text(l.name) || !(Number(l.price) >= 0))) return sendError(res, 422, 'Custom items need a name and a price');
    if (l.price !== undefined && l.price !== null && l.price !== '' && !(Number(l.price) >= 0 && Number(l.price) <= 100000)) return sendError(res, 422, 'Prices must be from 0 to 100000');
  }

  const t = await sequelize.transaction();
  const fail = async (code, message) => { await t.rollback(); return sendError(res, code, message); };
  try {
    const booking = await Booking.findByPk(req.params.id, { lock: t.LOCK.UPDATE, transaction: t });
    if (!booking || !canAccessLocation(req, booking.locationId)) return fail(404, 'Booking not found');
    if (booking.bookingType !== 'bulk_pickup') return fail(400, 'Only bulk pickups are billed here; app orders are priced when they are placed');
    if (booking.paymentStatus === 'paid') return fail(409, 'This order is already paid, so its bill can\'t change');
    if (!BILLABLE.includes(booking.status)) return fail(400, 'Bill the order after it is picked up and before it is handed over');

    const itemIds = lines.filter(l => l.itemId).map(l => l.itemId);
    const items = itemIds.length ? await Item.findAll({ where: { id: itemIds }, transaction: t }) : [];
    const overrides = await getPriceOverrides(booking.locationId, itemIds, t);
    let subtotal = 0;
    let quantity = 0;
    const rows = [];
    for (const l of lines) {
      const qty = Number(l.quantity);
      let name = text(l.name);
      let price = l.price !== undefined && l.price !== null && l.price !== '' ? Number(l.price) : null;
      if (l.itemId) {
        const item = items.find(i => i.id === l.itemId);
        if (!item) return fail(404, 'An item in the bill was not found');
        const storePrice = priceAt(item, overrides.get(item.id));
        if (storePrice === null && price === null) return fail(400, `${item.name} isn't offered at this store; enter a price for it`);
        name = name || item.name;
        price = price ?? storePrice;
      }
      const lineTotal = money(price * qty);
      subtotal += lineTotal;
      quantity += qty;
      rows.push({ bookingId: booking.id, itemId: l.itemId || null, name: name.slice(0, 120), quantity: qty, price: money(price), lineTotal, itemNote: text(l.note).slice(0, 255) || null });
    }
    subtotal = money(subtotal);

    const membership = await memberBenefits(booking.userId, t);
    const charges = chargesFor(await ruleFor(booking.locationId, t), { subtotal, quantity, freeDelivery: !!membership?.freeDelivery });
    const discount = Math.min(subtotal, memberDiscountOn(subtotal, membership));
    const total = money(subtotal - discount + charges.deliveryFee);
    const before = { subtotal: booking.subtotal, deliveryFee: booking.deliveryFee, discount: booking.discount, total: booking.total };

    await BookingItem.destroy({ where: { bookingId: booking.id }, transaction: t });
    await BookingItem.bulkCreate(rows, { transaction: t });
    booking.subtotal = subtotal;
    booking.deliveryFee = charges.deliveryFee;
    booking.discount = discount;
    booking.total = total;
    await booking.save({ transaction: t });
    await BookingEvent.create({
      bookingId: booking.id, actorId: req.user.id, type: 'billed', amount: total, itemCount: quantity,
      note: `${quantity} piece${quantity === 1 ? '' : 's'} · subtotal ₹${subtotal}${charges.deliveryFee ? ` + ₹${charges.deliveryFee} pickup & delivery` : ''}${discount ? ` − ₹${discount} member discount` : ''}`,
    }, { transaction: t });
    await audit(req, { action: 'booking.bill', entity: 'booking', entityId: booking.id, before, after: { subtotal, deliveryFee: charges.deliveryFee, discount, total, items: rows.length } }, t);
    await t.commit();

    return sendSuccess(res, 200, `Order ${booking.orderNumber} billed: ₹${total}`, {
      id: booking.id,
      subtotal,
      quantity,
      deliveryFee: charges.deliveryFee,
      waivedByMembership: charges.waivedByMembership,
      memberDiscount: discount,
      total,
      rule: charges.rule,
      items: rows,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// ===== Audit log and summary =====

/** GET /api/v1/admin/pickup/audit-logs?entity=&page=&limit= */
const listAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const where = req.query.entity ? { entity: String(req.query.entity) } : {};
    const { rows, count } = await AdminAuditLog.findAndCountAll({
      where,
      include: [{ model: User, as: 'actor', attributes: ['id', 'name', 'role'] }],
      order: [['created_at', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    return sendSuccess(res, 200, 'Audit log fetched', { logs: rows, total: count, page, totalPages: Math.max(1, Math.ceil(count / limit)) });
  } catch (error) {
    next(error);
  }
};

/** GET /api/v1/admin/pickup/summary — bulk pickups by status and the next scheduled days (store scope applies) */
const pickupSummary = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const today = dayIn(new Date(), settings.timezone);
    const scope = scopedLocationId(req) ? { locationId: scopedLocationId(req) } : {};
    const byStatus = await Booking.findAll({ where: { ...scope, bookingType: 'bulk_pickup' }, attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']], group: ['status'], raw: true });
    const unassigned = await Booking.count({ where: { ...scope, bookingType: 'bulk_pickup', driverId: null, status: ['pending', 'confirmed'] } });
    const upcoming = await Booking.findAll({
      where: { ...scope, pickupDate: { [Op.gte]: today }, status: { [Op.notIn]: ['cancelled'] } },
      attributes: ['pickupDate', 'bookingType', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['pickupDate', 'bookingType'],
      order: [['pickupDate', 'ASC']],
      raw: true,
    });
    return sendSuccess(res, 200, 'Pickup summary', {
      today,
      byStatus: Object.fromEntries(byStatus.map(r => [r.status, Number(r.count)])),
      unassigned,
      upcoming: upcoming.map(u => ({ date: u.pickupDate, bookingType: u.bookingType, count: Number(u.count) })),
      enabled: settings.enabled,
      bulkEnabled: settings.bulkEnabled,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPickupSettings, updatePickupSettings,
  listSlotsAdmin, createSlot, updateSlot, deleteSlot,
  listSlotOverrides, saveSlotOverride, deleteSlotOverride,
  listDateExceptions, saveDateException, deleteDateException,
  listChargeRules, createChargeRule, updateChargeRule, deleteChargeRule,
  listPickupLocations, updatePickupLocation,
  billBooking,
  listAuditLogs, pickupSummary,
};
