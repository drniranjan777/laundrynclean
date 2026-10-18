const { Booking, BookingItem } = require('../models/booking.model');
const { Item } = require('../models/category.model');
const User = require('../models/user.model');
const { calculateGst } = require('./gst.controller');
const { Location } = require('../models/location.model');
const { nextInvoiceNumber } = require('../services/location.service');
const { isUuid, scopedLocationId, locationFilter, canAccessLocation } = require('../utils/location-scope');
const { sendSuccess, sendError } = require('../utils/response');
const { sequelize } = require('../config/db');
const { generateOrderNumber } = require('../utils/helpers');
const { Op } = require('sequelize');
const crypto = require('crypto');

/**
 * Generate unique barcode for an item
 * Format: ORD-XXX-ITEM-01
 */
const generateBarcode = (orderNumber, itemIndex) => {
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${orderNumber}-${(itemIndex + 1).toString().padStart(2, '0')}-${suffix}`;
};

/**
 * POST /api/v1/admin/pos/create-order
 * Create an offline (walk-in) order
 */
const createOfflineOrder = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const {
      customerName, customerPhone, customerNote,
      items, // [{ itemId, name, quantity, price, color, size, garmentColor, itemNote }]
      discount = 0,
      paymentMethod, // cash, upi, card, pay_later
      paymentMethodDetail, // "Cash", "UPI - PhonePe", "Card - HDFC"
      paymentStatus = 'paid', // paid, pending (for pay_later)
      expectedDeliveryDate,
    } = req.body;

    // Validate
    if (!customerName || !customerPhone) {
      await t.rollback();
      return sendError(res, 422, 'Customer name and phone are required');
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return sendError(res, 422, 'At least one item is required');
    }

    // The bill belongs to a store: the manager's own, or the one the admin is billing for
    const locationId = scopedLocationId(req) || (isUuid(req.body.locationId) ? req.body.locationId : null);
    const location = locationId ? await Location.findOne({ where: { id: locationId, isActive: true }, transaction: t }) : null;
    if (!location) {
      await t.rollback();
      return sendError(res, 422, 'Choose an active store location for this bill');
    }

    // Generate order number and the store's next invoice number
    const orderNumber = await generateOrderNumber(t);
    const invoiceNumber = await nextInvoiceNumber(location.id, t);

    // Calculate subtotal
    let subtotal = 0;
    const orderItems = items.map((item, idx) => {
      const lineTotal = parseFloat(item.price) * parseInt(item.quantity);
      subtotal += lineTotal;
      return {
        itemId: item.itemId || null,
        name: item.name,
        quantity: parseInt(item.quantity),
        price: parseFloat(item.price),
        lineTotal,
        color: item.color || null,
        size: item.size || null,
        garmentColor: item.garmentColor || null,
        itemNote: item.itemNote || null,
        barcode: generateBarcode(orderNumber, idx),
      };
    });

    // Calculate GST
    const discountAmount = parseFloat(discount) || 0;
    const afterDiscount = subtotal - discountAmount;
    const gstResult = await calculateGst(afterDiscount);

    const total = gstResult.totalWithGst;

    // Check if customer exists (link to app user if phone matches)
    let userId = null;
    const existingUser = await User.findOne({ where: { phone: customerPhone.slice(-10) } });
    if (existingUser) {
      userId = existingUser.id;
    }

    // Create booking
    const booking = await Booking.create({
      userId,
      orderNumber,
      invoiceNumber,
      locationId: location.id,
      orderType: 'offline',
      addressId: null,
      pickupDate: null,
      timeSlotId: null,
      subtotal,
      deliveryFee: 0,
      discount: discountAmount,
      gstAmount: gstResult.gstAmount,
      gstRate: gstResult.gstRate,
      cgst: gstResult.cgst,
      sgst: gstResult.sgst,
      total,
      paymentMethod: paymentMethod || 'cod',
      paymentMethodDetail: paymentMethodDetail || 'Cash',
      paymentStatus: paymentStatus || 'paid',
      status: 'confirmed',
      customerName,
      customerPhone,
      customerNote: customerNote || null,
      disclaimerAccepted: true,
      estimatedDeliveryDate: expectedDeliveryDate || null,
      barcodePrinted: false,
    }, { transaction: t });

    // Create booking items with barcodes
    for (const item of orderItems) {
      await BookingItem.create({
        bookingId: booking.id,
        ...item,
      }, { transaction: t });
    }

    await t.commit();

    // Fetch full booking with items
    const fullBooking = await Booking.findByPk(booking.id, {
      include: [{ model: BookingItem, as: 'items' }],
    });

    return sendSuccess(res, 201, 'Offline order created', {
      booking: fullBooking,
      invoiceNumber,
      // Store details for the printed receipt
      location: {
        id: location.id, name: location.name, code: location.code, addressLine: location.addressLine,
        city: location.city, state: location.state, pincode: location.pincode, phone: location.phone, gstin: location.gstin,
      },
      barcodes: orderItems.map(i => ({ name: i.name, barcode: i.barcode, garmentColor: i.garmentColor })),
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * GET /api/v1/admin/pos/orders
 * Get offline orders list
 */
const getOfflineOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = { orderType: 'offline', ...locationFilter(req) };
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { orderNumber: { [Op.iLike]: `%${search}%` } },
        { invoiceNumber: { [Op.iLike]: `%${search}%` } },
        { customerName: { [Op.iLike]: `%${search}%` } },
        { customerPhone: { [Op.like]: `%${search}%` } },
      ];
    }

    const { rows, count } = await Booking.findAndCountAll({
      where,
      include: [{ model: BookingItem, as: 'items' }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    return sendSuccess(res, 200, 'Offline orders fetched', {
      orders: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/pos/orders/:id
 * Get single offline order with full details (for invoice/print)
 */
const getOfflineOrderDetail = async (req, res, next) => {
  try {
    const booking = await Booking.findByPk(req.params.id, {
      include: [{ model: BookingItem, as: 'items' }],
    });

    if (!booking || !canAccessLocation(req, booking.locationId)) return sendError(res, 404, 'Order not found');

    return sendSuccess(res, 200, 'Order detail fetched', booking);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/pos/orders/:id/barcode-printed
 * Mark barcodes as printed
 */
const markBarcodePrinted = async (req, res, next) => {
  try {
    const booking = await Booking.findByPk(req.params.id);
    if (!booking || !canAccessLocation(req, booking.locationId)) return sendError(res, 404, 'Order not found');

    booking.barcodePrinted = true;
    await booking.save();

    return sendSuccess(res, 200, 'Barcode marked as printed');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/pos/scan-barcode
 * Scan barcode to find item and mark as delivered
 */
const scanBarcode = async (req, res, next) => {
  try {
    const { barcode } = req.body;
    if (!barcode) return sendError(res, 422, 'Barcode is required');

    const bookingItem = await BookingItem.findOne({ where: { barcode } });
    if (!bookingItem) return sendError(res, 404, 'Item not found for this barcode');

    const booking = await Booking.findByPk(bookingItem.bookingId, {
      include: [{ model: BookingItem, as: 'items' }],
    });
    if (!canAccessLocation(req, booking.locationId)) return sendError(res, 404, 'Item not found for this barcode');

    return sendSuccess(res, 200, 'Item found', {
      booking: {
        id: booking.id,
        orderNumber: booking.orderNumber,
        invoiceNumber: booking.invoiceNumber,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        status: booking.status,
        total: booking.total,
      },
      scannedItem: {
        id: bookingItem.id,
        name: bookingItem.name,
        barcode: bookingItem.barcode,
        garmentColor: bookingItem.garmentColor,
        itemNote: bookingItem.itemNote,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/pos/stats
 * Get offline order stats for dashboard
 */
const getOfflineStats = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const offline = { orderType: 'offline', ...locationFilter(req) };

    const totalOfflineOrders = await Booking.count({ where: offline });
    const todayOfflineOrders = await Booking.count({
      where: { ...offline, created_at: { [Op.gte]: new Date(today) } },
    });

    const offlineRevenue = await Booking.sum('total', {
      where: { ...offline, paymentStatus: 'paid' },
    });

    const pendingPayments = await Booking.count({
      where: { ...offline, paymentStatus: 'pending' },
    });

    // Payment method breakdown
    const cashOrders = await Booking.count({ where: { ...offline, paymentMethod: 'cod' } });
    const upiOrders = await Booking.count({ where: { ...offline, paymentMethod: 'upi' } });
    const cardOrders = await Booking.count({ where: { ...offline, paymentMethod: 'card' } });

    return sendSuccess(res, 200, 'Offline stats fetched', {
      totalOfflineOrders,
      todayOfflineOrders,
      offlineRevenue: parseFloat(offlineRevenue || 0),
      pendingPayments,
      paymentBreakdown: { cash: cashOrders, upi: upiOrders, card: cardOrders },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createOfflineOrder, getOfflineOrders, getOfflineOrderDetail, markBarcodePrinted, scanBarcode, getOfflineStats };
