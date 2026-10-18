const GstSettings = require('../models/gst-settings.model');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/v1/admin/gst
 * Get GST settings (creates default if not exists)
 */
const getGstSettings = async (req, res, next) => {
  try {
    let settings = await GstSettings.findOne();
    if (!settings) {
      settings = await GstSettings.create({
        gstRate: 18.00,
        gstType: 'exclusive',
        hsnCode: '9971',
        isEnabled: true,
        invoicePrefix: 'INV',
        invoiceCounter: 0,
      });
    }
    return sendSuccess(res, 200, 'GST settings fetched', settings);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/admin/gst
 * Update GST settings
 */
const updateGstSettings = async (req, res, next) => {
  try {
    let settings = await GstSettings.findOne();
    if (!settings) {
      settings = await GstSettings.create(req.body);
    } else {
      const { gstin, businessName, businessAddress, businessPhone, gstRate, gstType, hsnCode, isEnabled, invoicePrefix } = req.body;
      await settings.update({ gstin, businessName, businessAddress, businessPhone, gstRate, gstType, hsnCode, isEnabled, invoicePrefix });
    }
    return sendSuccess(res, 200, 'GST settings updated', settings);
  } catch (error) {
    next(error);
  }
};

// Invoice numbers come from each location's own series (location.service nextInvoiceNumber)

/**
 * Calculate GST for an amount (internal use)
 */
const calculateGst = async (subtotal) => {
  const settings = await GstSettings.findOne();
  if (!settings || !settings.isEnabled) {
    return { gstAmount: 0, cgst: 0, sgst: 0, totalWithGst: subtotal, gstRate: 0 };
  }

  const rate = parseFloat(settings.gstRate);
  let gstAmount, totalWithGst;

  if (settings.gstType === 'exclusive') {
    // GST added on top of subtotal
    gstAmount = (subtotal * rate) / 100;
    totalWithGst = subtotal + gstAmount;
  } else {
    // GST already included in subtotal
    gstAmount = subtotal - (subtotal * 100) / (100 + rate);
    totalWithGst = subtotal;
  }

  gstAmount = Math.round(gstAmount * 100) / 100;
  const cgst = Math.round((gstAmount / 2) * 100) / 100;
  const sgst = Math.round((gstAmount / 2) * 100) / 100;

  return { gstAmount, cgst, sgst, totalWithGst: Math.round(totalWithGst * 100) / 100, gstRate: rate };
};

module.exports = { getGstSettings, updateGstSettings, calculateGst };
