const { sendSuccess, sendError } = require('../utils/response');
const ServiceablePincode = require('../models/serviceable-pincode.model');
const { findLocationByPincode } = require('../services/location.service');
const { Op } = require('sequelize');

/**
 * POST /api/v1/location/check-pincode
 * Check if a pincode is serviceable
 */
const checkPincode = async (req, res, next) => {
  try {
    const { pincode } = req.body;

    const serviceArea = await ServiceablePincode.findOne({
      where: { pincode, isActive: true },
    });

    if (!serviceArea) {
      return sendSuccess(res, 200, 'Service not available in this area', {
        isServiceable: false,
        pincode,
        message: 'Sorry, we do not serve this area yet. We are expanding soon!',
      });
    }

    const store = await findLocationByPincode(serviceArea.pincode);
    return sendSuccess(res, 200, 'Service available', {
      isServiceable: true,
      pincode: serviceArea.pincode,
      city: serviceArea.city,
      state: serviceArea.state,
      area: serviceArea.area,
      deliveryDays: serviceArea.deliveryDays,
      minimumOrder: serviceArea.minimumOrder,
      // Store that serves this pincode (its prices apply to the order)
      location: store ? { id: store.id, name: store.name, code: store.code, phone: store.phone } : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/location/check-coordinates
 * Check serviceability by lat/lng (Use my Current Location)
 * Reverse geocodes to pincode, then checks serviceability
 */
const checkCoordinates = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;

    // TODO: Integrate with Google Maps / OpenStreetMap Geocoding API
    // to convert lat/lng to pincode
    // For now, return a placeholder response

    // Example integration:
    // const response = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
    //   params: { latlng: `${lat},${lng}`, key: process.env.GOOGLE_MAPS_KEY }
    // });
    // Extract pincode from response

    return sendSuccess(res, 200, 'Location detected', {
      isServiceable: false,
      lat,
      lng,
      message: 'Geocoding integration pending. Please enter pincode manually.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/location/serviceable-areas
 * Get list of all serviceable areas (for admin or dropdown)
 */
const getServiceableAreas = async (req, res, next) => {
  try {
    const { city, search } = req.query;

    const where = { isActive: true };
    if (city) where.city = city;
    if (search) {
      where[Op.or] = [
        { pincode: { [Op.like]: `${search}%` } },
        { area: { [Op.iLike]: `%${search}%` } },
        { city: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const areas = await ServiceablePincode.findAll({
      where,
      order: [['city', 'ASC'], ['pincode', 'ASC']],
      attributes: ['id', 'pincode', 'city', 'state', 'area', 'deliveryDays', 'minimumOrder'],
    });

    return sendSuccess(res, 200, 'Serviceable areas fetched', areas);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/location/save
 * Kept for older app builds. It no longer writes addresses: it used to overwrite the pincode of the
 * customer's default address, and failed for customers without one (it created an address with no name).
 * Addresses are managed with /addresses; the app keeps the chosen pincode itself.
 * Returns whether the pincode is served and by which store, plus the default address id (if any).
 */
const saveUserLocation = async (req, res, next) => {
  try {
    const { pincode } = req.body;
    const Address = require('../models/address.model');

    const serviceArea = await ServiceablePincode.findOne({ where: { pincode, isActive: true } });
    const store = serviceArea ? await findLocationByPincode(serviceArea.pincode) : null;
    const address = await Address.findOne({ where: { userId: req.user.id, isDefault: true }, attributes: ['id'] });

    return sendSuccess(res, 200, 'Location saved', {
      pincode,
      isServiceable: Boolean(serviceArea),
      location: store ? { id: store.id, name: store.name, code: store.code, phone: store.phone } : null,
      addressId: address?.id || null,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { checkPincode, checkCoordinates, getServiceableAreas, saveUserLocation };
