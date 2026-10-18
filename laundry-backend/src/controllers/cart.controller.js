const { CartItem, Favorite } = require('../models/cart.model');
const { Item } = require('../models/category.model');
const Address = require('../models/address.model');
const { Location } = require('../models/location.model');
const { sendSuccess, sendError } = require('../utils/response');
const { memberBenefits, memberDiscountOn } = require('../services/subscription.service');
const { findLocationByPincode, getPriceOverrides, priceAt } = require('../services/location.service');
const { isUuid } = require('../utils/location-scope');

// Item fields the apps show in the cart and favourites (icon + categoryId pick the item's icon)
const ITEM_FIELDS = ['id', 'name', 'brand', 'imageUrl', 'icon', 'categoryId', 'price', 'originalPrice', 'discountPercent', 'colors', 'sizes'];

/**
 * Store whose prices apply: ?addressId (the chosen pickup address), else ?locationId (the store the app picked
 * from the customer's pin code, before they have an address), else the default address's store.
 */
const cartLocation = async (req) => {
  if (req.query.addressId) {
    const address = await Address.findOne({ where: { id: req.query.addressId, userId: req.user.id } });
    return address ? findLocationByPincode(address.pincode) : null;
  }
  if (isUuid(req.query.locationId)) return Location.findOne({ where: { id: req.query.locationId, isActive: true } });
  const address = await Address.findOne({ where: { userId: req.user.id, isDefault: true } });
  return address ? findLocationByPincode(address.pincode) : null;
};

const DELIVERY_FEE = 50;
const FREE_DELIVERY_THRESHOLD = 250;
const MIN_ITEMS_FREE_DELIVERY = 10;

/**
 * GET /api/v1/cart
 * Get cart items with total calculation
 */
const getCart = async (req, res, next) => {
  try {
    const cartItems = await CartItem.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Item,
        as: 'item',
        attributes: ITEM_FIELDS,
      }],
      order: [['created_at', 'DESC']],
    });

    const location = await cartLocation(req);
    const overrides = await getPriceOverrides(location?.id, cartItems.map(ci => ci.itemId));

    // Calculate totals (items the store doesn't offer are flagged and left out)
    let subtotal = 0;
    let totalItems = 0;
    const items = cartItems.map(ci => {
      const unitPrice = priceAt(ci.item, overrides.get(ci.itemId));
      const json = ci.toJSON();
      if (unitPrice === null) {
        return { ...json, isAvailable: false, lineTotal: 0 };
      }
      const itemPrice = unitPrice * ci.quantity;
      subtotal += itemPrice;
      totalItems += ci.quantity;
      return {
        ...json,
        item: { ...json.item, price: unitPrice.toFixed(2), basePrice: json.item.price },
        isAvailable: true,
        lineTotal: itemPrice,
      };
    });

    // Delivery fee logic: ₹50 if order < ₹250 OR fewer than 10 items, unless the customer's plan has free delivery
    const membership = await memberBenefits(req.user.id);
    let deliveryFee = 0;
    if ((subtotal < FREE_DELIVERY_THRESHOLD || totalItems < MIN_ITEMS_FREE_DELIVERY) && !membership?.freeDelivery) {
      deliveryFee = DELIVERY_FEE;
    }
    // Members get their plan's discount on every order (promo codes apply on top, at checkout)
    const memberDiscount = memberDiscountOn(subtotal, membership);

    const total = subtotal - memberDiscount + deliveryFee;

    return sendSuccess(res, 200, 'Cart fetched', {
      location: location ? { id: location.id, name: location.name, code: location.code } : null,
      items,
      itemCount: cartItems.length,
      totalQuantity: totalItems,
      subtotal: Math.round(subtotal * 100) / 100,
      deliveryFee,
      memberDiscount,
      membership,
      freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
      minItemsFreeDelivery: MIN_ITEMS_FREE_DELIVERY,
      total: Math.round(total * 100) / 100,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/cart
 * Add item to cart
 */
const addToCart = async (req, res, next) => {
  try {
    const { itemId, quantity = 1, color, size } = req.body;

    // Check item exists
    const item = await Item.findByPk(itemId);
    if (!item || !item.isActive) return sendError(res, 404, 'Item not found');

    // Check if already in cart (same item + color + size)
    const existing = await CartItem.findOne({
      where: { userId: req.user.id, itemId, color: color || null, size: size || null },
    });

    if (existing) {
      existing.quantity += quantity;
      await existing.save();
      return sendSuccess(res, 200, 'Cart updated', existing);
    }

    const cartItem = await CartItem.create({
      userId: req.user.id,
      itemId,
      quantity,
      color,
      size,
    });

    return sendSuccess(res, 201, 'Item added to cart', cartItem);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/cart/:id/quantity
 * Update cart item quantity
 */
const updateQuantity = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    const cartItem = await CartItem.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!cartItem) return sendError(res, 404, 'Cart item not found');

    if (quantity <= 0) {
      await cartItem.destroy();
      return sendSuccess(res, 200, 'Item removed from cart');
    }

    cartItem.quantity = quantity;
    await cartItem.save();
    return sendSuccess(res, 200, 'Quantity updated', cartItem);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/cart/:id
 * Remove item from cart
 */
const removeFromCart = async (req, res, next) => {
  try {
    const cartItem = await CartItem.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!cartItem) return sendError(res, 404, 'Cart item not found');

    await cartItem.destroy();
    return sendSuccess(res, 200, 'Item removed from cart');
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/cart
 * Clear entire cart
 */
const clearCart = async (req, res, next) => {
  try {
    await CartItem.destroy({ where: { userId: req.user.id } });
    return sendSuccess(res, 200, 'Cart cleared');
  } catch (error) {
    next(error);
  }
};

// ===== FAVORITES =====

/**
 * GET /api/v1/cart/favorites
 * Get user's favorite items, priced like the cart (?addressId / ?locationId / default address).
 * Items the store doesn't offer stay in the list with isAvailable: false.
 */
const getFavorites = async (req, res, next) => {
  try {
    const favorites = await Favorite.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Item,
        as: 'item',
        attributes: [...ITEM_FIELDS, 'avgRating'],
      }],
      order: [['created_at', 'DESC']],
    });

    const location = await cartLocation(req);
    const overrides = await getPriceOverrides(location?.id, favorites.map(f => f.itemId));
    const priced = favorites.map((f) => {
      const json = f.toJSON();
      if (!json.item) return { ...json, isAvailable: false };
      const unitPrice = priceAt(f.item, overrides.get(f.itemId));
      return unitPrice === null
        ? { ...json, isAvailable: false }
        : { ...json, isAvailable: true, item: { ...json.item, price: unitPrice.toFixed(2), basePrice: json.item.price } };
    });

    return sendSuccess(res, 200, 'Favorites fetched', priced);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/cart/favorites
 * Add item to favorites
 */
const addToFavorites = async (req, res, next) => {
  try {
    const { itemId } = req.body;

    const item = await Item.findByPk(itemId);
    if (!item) return sendError(res, 404, 'Item not found');

    const [favorite, created] = await Favorite.findOrCreate({
      where: { userId: req.user.id, itemId },
      defaults: { userId: req.user.id, itemId },
    });

    if (!created) return sendSuccess(res, 200, 'Already in favorites', favorite);
    return sendSuccess(res, 201, 'Added to favorites', favorite);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/cart/favorites/:itemId
 * Remove item from favorites
 */
const removeFromFavorites = async (req, res, next) => {
  try {
    const deleted = await Favorite.destroy({
      where: { userId: req.user.id, itemId: req.params.itemId },
    });

    if (!deleted) return sendError(res, 404, 'Item not in favorites');
    return sendSuccess(res, 200, 'Removed from favorites');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCart, addToCart, updateQuantity, removeFromCart, clearCart,
  getFavorites, addToFavorites, removeFromFavorites,
};
