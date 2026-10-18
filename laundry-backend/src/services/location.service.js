const { sequelize } = require('../config/db');
const { Location, LocationItemPrice, LocationTimeSlot } = require('../models/location.model');
const ServiceablePincode = require('../models/serviceable-pincode.model');
const Address = require('../models/address.model');
const { isUuid } = require('../utils/location-scope');

const locationError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/** Active location that serves a pincode, or null */
const findLocationByPincode = async (pincode, transaction) => {
  if (!pincode) return null;
  const area = await ServiceablePincode.findOne({ where: { pincode: String(pincode).trim(), isActive: true }, transaction });
  if (!area?.locationId) return null;
  return Location.findOne({ where: { id: area.locationId, isActive: true }, transaction });
};

/**
 * Location whose prices a catalogue request should see: an explicit ?locationId, then
 * ?pincode, then the signed-in customer's default address. (The admin panel's location
 * header is ignored here so the catalogue admin keeps showing base prices.)
 */
const resolveCatalogueLocationId = async (req) => {
  if (isUuid(req.query.locationId)) return req.query.locationId;
  if (req.query.pincode) return (await findLocationByPincode(req.query.pincode))?.id || null;
  if (req.user?.id) {
    const address = await Address.findOne({ where: { userId: req.user.id, isDefault: true } });
    if (address) return (await findLocationByPincode(address.pincode))?.id || null;
  }
  return null;
};

/** Price overrides for these items at a location, keyed by item id */
const getPriceOverrides = async (locationId, itemIds, transaction) => {
  if (!locationId || itemIds.length === 0) return new Map();
  const rows = await LocationItemPrice.findAll({ where: { locationId, itemId: itemIds }, transaction });
  return new Map(rows.map(r => [r.itemId, r]));
};

/** Item ids hidden at a location */
const getUnavailableItemIds = async (locationId) => {
  if (!locationId) return [];
  const rows = await LocationItemPrice.findAll({ where: { locationId, isAvailable: false }, attributes: ['itemId'] });
  return rows.map(r => r.itemId);
};

/** An item's price at a location (number), or null when the item isn't offered there */
const priceAt = (item, override) => {
  if (override && !override.isAvailable) return null;
  return override && override.price !== null ? parseFloat(override.price) : parseFloat(item.price);
};

/**
 * Catalogue items with location prices applied, as plain objects. Prices keep the
 * API's "50.00" string format; basePrice is the catalogue price before the override.
 */
const applyLocationPrices = async (items, locationId) => {
  const list = items.map(i => (typeof i.toJSON === 'function' ? i.toJSON() : i));
  const overrides = await getPriceOverrides(locationId, list.map(i => i.id));
  return list.flatMap((item) => {
    const price = priceAt(item, overrides.get(item.id));
    if (price === null) return [];
    return [{ ...item, price: price.toFixed(2), basePrice: parseFloat(item.price).toFixed(2) }];
  });
};

/**
 * Orders per day each time slot takes at a location, keyed by slot id: the location's own
 * capacity if it has one, else the slot's maxBookings (also used when locationId is null).
 */
const getSlotCapacities = async (locationId, slots, transaction) => {
  const rows = locationId && slots.length
    ? await LocationTimeSlot.findAll({ where: { locationId, timeSlotId: slots.map(s => s.id) }, transaction })
    : [];
  const own = new Map(rows.map(r => [r.timeSlotId, r.maxBookings]));
  return new Map(slots.map(s => [s.id, own.has(s.id) ? own.get(s.id) : s.maxBookings]));
};

/**
 * Next invoice number in a location's own series. The counter is bumped in the same
 * UPDATE that reads it, so concurrent bills can't get the same number, and a rolled-back
 * order gives its number back.
 */
const nextInvoiceNumber = async (locationId, transaction) => {
  const [rows] = await sequelize.query(
    `UPDATE locations SET invoice_counter = invoice_counter + 1, updated_at = NOW()
     WHERE id = :id RETURNING invoice_prefix, invoice_counter`,
    { replacements: { id: locationId }, transaction }
  );
  if (!rows[0]) throw locationError(404, 'Location not found');
  return `${rows[0].invoice_prefix}-${String(rows[0].invoice_counter).padStart(5, '0')}`;
};

module.exports = {
  locationError,
  findLocationByPincode,
  resolveCatalogueLocationId,
  getPriceOverrides,
  getUnavailableItemIds,
  priceAt,
  applyLocationPrices,
  getSlotCapacities,
  nextInvoiceNumber,
};
