const { Category, SubCategory, Item } = require('../models/category.model');
const { sendSuccess, sendError } = require('../utils/response');
const { Op } = require('sequelize');
const { resolveCatalogueLocationId, getUnavailableItemIds, applyLocationPrices } = require('../services/location.service');

/**
 * GET /api/v1/categories
 * Get all categories with sub-categories
 */
const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.findAll({
      where: { isActive: true },
      include: [{
        model: SubCategory,
        as: 'subCategories',
        where: { isActive: true },
        required: false,
        order: [['sortOrder', 'ASC']],
      }],
      order: [['sortOrder', 'ASC']],
    });

    return sendSuccess(res, 200, 'Categories fetched', categories);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/categories/:categoryId/items
 * Get items by category with optional sub-category filter and search
 */
const getItems = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const { subCategoryId, search, page = 1, limit = 20, sort } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const locationId = await resolveCatalogueLocationId(req);
    const where = { categoryId, isActive: true };
    if (subCategoryId) where.subCategoryId = subCategoryId;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { brand: { [Op.iLike]: `%${search}%` } },
      ];
    }
    // Leave out items the location doesn't offer (in the query, so paging stays right)
    const hidden = await getUnavailableItemIds(locationId);
    if (hidden.length) where.id = { [Op.notIn]: hidden };

    // Sort options (price sorts use the catalogue base price)
    let order = [['sortOrder', 'ASC']];
    if (sort === 'price_low') order = [['price', 'ASC']];
    if (sort === 'price_high') order = [['price', 'DESC']];
    if (sort === 'rating') order = [['avgRating', 'DESC']];
    if (sort === 'discount') order = [['discountPercent', 'DESC']];

    const { rows, count } = await Item.findAndCountAll({
      where,
      order,
      limit: parseInt(limit),
      offset,
      include: [
        { model: SubCategory, as: 'subCategory', attributes: ['id', 'name'] },
      ],
    });

    return sendSuccess(res, 200, 'Items fetched', {
      locationId,
      items: await applyLocationPrices(rows, locationId),
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/categories/items/:itemId
 * Get single item detail
 */
const getItemById = async (req, res, next) => {
  try {
    const item = await Item.findOne({
      where: { id: req.params.itemId, isActive: true },
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name'] },
        { model: SubCategory, as: 'subCategory', attributes: ['id', 'name'] },
      ],
    });

    if (!item) return sendError(res, 404, 'Item not found');

    const [priced] = await applyLocationPrices([item], await resolveCatalogueLocationId(req));
    if (!priced) return sendError(res, 404, 'This item is not available at your nearest store');
    return sendSuccess(res, 200, 'Item fetched', priced);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/categories/items/search
 * Search items across all categories
 */
const searchItems = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    if (!q) return sendError(res, 400, 'Search query is required');

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const locationId = await resolveCatalogueLocationId(req);
    const where = {
      isActive: true,
      [Op.or]: [
        { name: { [Op.iLike]: `%${q}%` } },
        { brand: { [Op.iLike]: `%${q}%` } },
      ],
    };
    const hidden = await getUnavailableItemIds(locationId);
    if (hidden.length) where.id = { [Op.notIn]: hidden };

    const { rows, count } = await Item.findAndCountAll({
      where,
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name'] },
        { model: SubCategory, as: 'subCategory', attributes: ['id', 'name'] },
      ],
      limit: parseInt(limit),
      offset,
      order: [['avgRating', 'DESC']],
    });

    return sendSuccess(res, 200, 'Search results', {
      locationId,
      items: await applyLocationPrices(rows, locationId),
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCategories, getItems, getItemById, searchItems };
