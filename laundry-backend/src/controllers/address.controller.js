const Address = require('../models/address.model');
const { sendSuccess, sendError } = require('../utils/response');

const getAddresses = async (req, res, next) => {
  try {
    const addresses = await Address.findAll({
      where: { userId: req.user.id },
      order: [['isDefault', 'DESC'], ['created_at', 'DESC']],
    });
    return sendSuccess(res, 200, 'Addresses fetched', addresses);
  } catch (error) {
    next(error);
  }
};

const addAddress = async (req, res, next) => {
  try {
    const { fullName, phone, addressLine, city, state, pincode, country, lat, lng, label, isDefault } = req.body;

    if (isDefault) {
      await Address.update({ isDefault: false }, { where: { userId: req.user.id } });
    }

    const addressCount = await Address.count({ where: { userId: req.user.id } });

    const address = await Address.create({
      userId: req.user.id,
      fullName,
      phone,
      addressLine,
      city,
      state,
      pincode,
      country: country || 'India',
      lat,
      lng,
      label: label || 'Home',
      isDefault: isDefault || addressCount === 0,
    });

    return sendSuccess(res, 201, 'Address added', address);
  } catch (error) {
    next(error);
  }
};

const updateAddress = async (req, res, next) => {
  try {
    const address = await Address.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!address) return sendError(res, 404, 'Address not found');

    const { fullName, phone, addressLine, city, state, pincode, country, lat, lng, label } = req.body;
    await address.update({ fullName, phone, addressLine, city, state, pincode, country, lat, lng, label });
    return sendSuccess(res, 200, 'Address updated', address);
  } catch (error) {
    next(error);
  }
};

const setDefault = async (req, res, next) => {
  try {
    const address = await Address.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!address) return sendError(res, 404, 'Address not found');

    await Address.update({ isDefault: false }, { where: { userId: req.user.id } });
    address.isDefault = true;
    await address.save();

    return sendSuccess(res, 200, 'Default address updated', address);
  } catch (error) {
    next(error);
  }
};

const deleteAddress = async (req, res, next) => {
  try {
    const address = await Address.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!address) return sendError(res, 404, 'Address not found');

    // Orders keep pointing at their address (bookings.address_id), so a used address can't be removed
    const { Booking } = require('../models/booking.model');
    if (await Booking.count({ where: { addressId: address.id } })) {
      return sendError(res, 409, 'This address is linked to your orders, so it can\'t be removed. Add a new address and make it your default instead.');
    }

    const wasDefault = address.isDefault;
    await address.destroy();

    if (wasDefault) {
      const nextDefault = await Address.findOne({
        where: { userId: req.user.id },
        order: [['created_at', 'DESC']],
      });
      if (nextDefault) {
        nextDefault.isDefault = true;
        await nextDefault.save();
      }
    }

    return sendSuccess(res, 200, 'Address deleted');
  } catch (error) {
    next(error);
  }
};

module.exports = { getAddresses, addAddress, updateAddress, setDefault, deleteAddress };
