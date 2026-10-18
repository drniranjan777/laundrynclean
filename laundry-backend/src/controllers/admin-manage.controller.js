const { Category, SubCategory, Item } = require('../models/category.model');
const { SubscriptionPlan } = require('../models/subscription.model');
const { WalletPackage } = require('../models/wallet.model');
const { PromoCode } = require('../models/promocode.model');
const ServiceablePincode = require('../models/serviceable-pincode.model');
const { Location } = require('../models/location.model');
const { Content, FAQ } = require('../models/content.model');
const { sendSuccess, sendError } = require('../utils/response');

// ========== CATEGORIES ==========

const createCategory = async (req, res, next) => {
  try {
    const { name, slug, icon, imageUrl } = req.body;
    if (!name || !slug) return sendError(res, 422, 'Name and slug are required');

    const exists = await Category.findOne({ where: { slug } });
    if (exists) return sendError(res, 409, 'Category with this slug already exists');

    const category = await Category.create({ name, slug, icon, imageUrl });
    return sendSuccess(res, 201, 'Category created', category);
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return sendError(res, 404, 'Category not found');

    const { name, slug, icon, imageUrl, isActive } = req.body;
    await category.update({ name, slug, icon, imageUrl, isActive });
    return sendSuccess(res, 200, 'Category updated', category);
  } catch (error) {
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return sendError(res, 404, 'Category not found');

    await category.destroy();
    return sendSuccess(res, 200, 'Category deleted');
  } catch (error) {
    next(error);
  }
};

// ========== SUB-CATEGORIES ==========

const createSubCategory = async (req, res, next) => {
  try {
    const { categoryId, name, slug, color } = req.body;
    if (!categoryId || !name || !slug) return sendError(res, 422, 'Category, name, and slug are required');

    const category = await Category.findByPk(categoryId);
    if (!category) return sendError(res, 404, 'Category not found');

    const subCat = await SubCategory.create({ categoryId, name, slug, color, isActive: true });
    return sendSuccess(res, 201, 'Sub-category created', subCat);
  } catch (error) {
    next(error);
  }
};

const updateSubCategory = async (req, res, next) => {
  try {
    const subCat = await SubCategory.findByPk(req.params.id);
    if (!subCat) return sendError(res, 404, 'Sub-category not found');

    const { name, slug, color, isActive } = req.body;
    await subCat.update({ name, slug, color, isActive });
    return sendSuccess(res, 200, 'Sub-category updated', subCat);
  } catch (error) {
    next(error);
  }
};

const deleteSubCategory = async (req, res, next) => {
  try {
    const subCat = await SubCategory.findByPk(req.params.id);
    if (!subCat) return sendError(res, 404, 'Sub-category not found');

    await subCat.destroy();
    return sendSuccess(res, 200, 'Sub-category deleted');
  } catch (error) {
    next(error);
  }
};

// ========== CATALOGUE (ITEMS) ==========

// Icon key from the admin panel's cloth icon library; '' or null = pick one from the item's name
const ICON_KEY = /^[a-z0-9_-]{1,40}$/;
const isIconValue = (icon) => icon === undefined || icon === null || icon === '' || (typeof icon === 'string' && ICON_KEY.test(icon));

const createItem = async (req, res, next) => {
  try {
    const { categoryId, subCategoryId, name, brand, description, imageUrl, icon, price, originalPrice, discountPercent, colors, sizes, isAddOn, isLimitedOffer } = req.body;
    if (!categoryId || !name || !price) return sendError(res, 422, 'Category, name, and price are required');
    if (!isIconValue(icon)) return sendError(res, 422, 'Icon must be a key from the icon library');

    const category = await Category.findByPk(categoryId);
    if (!category) return sendError(res, 404, 'Category not found');

    const item = await Item.create({
      categoryId, subCategoryId: subCategoryId || null, name, brand, description, imageUrl,
      icon: icon || null,
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : null,
      discountPercent: parseInt(discountPercent) || 0,
      colors: colors || null,
      sizes: sizes || null,
      isAddOn: isAddOn || false,
      isLimitedOffer: isLimitedOffer || false,
      isActive: true,
    });
    return sendSuccess(res, 201, 'Item created', item);
  } catch (error) {
    next(error);
  }
};

const updateItem = async (req, res, next) => {
  try {
    const item = await Item.findByPk(req.params.id);
    if (!item) return sendError(res, 404, 'Item not found');

    const { name, brand, description, imageUrl, icon, price, originalPrice, discountPercent, colors, sizes, isAddOn, isLimitedOffer, isActive, subCategoryId } = req.body;
    if (!isIconValue(icon)) return sendError(res, 422, 'Icon must be a key from the icon library');
    await item.update({
      name, brand, description, imageUrl, subCategoryId,
      icon: icon === undefined ? undefined : (icon || null), // left out = keep the current icon

      price: price ? parseFloat(price) : item.price,
      originalPrice: originalPrice ? parseFloat(originalPrice) : item.originalPrice,
      discountPercent: discountPercent !== undefined ? parseInt(discountPercent) : item.discountPercent,
      colors, sizes, isAddOn, isLimitedOffer, isActive,
    });
    return sendSuccess(res, 200, 'Item updated', item);
  } catch (error) {
    next(error);
  }
};

const deleteItem = async (req, res, next) => {
  try {
    const item = await Item.findByPk(req.params.id);
    if (!item) return sendError(res, 404, 'Item not found');

    await item.destroy();
    return sendSuccess(res, 200, 'Item deleted');
  } catch (error) {
    next(error);
  }
};

// ========== SUBSCRIPTION PLANS ==========

const createPlan = async (req, res, next) => {
  try {
    const { name, price, duration, durationType, description, features, freeDelivery, discountPercent, trialDays } = req.body;
    if (!name || !price) return sendError(res, 422, 'Name and price are required');

    const plan = await SubscriptionPlan.create({
      name, price, duration: duration || 30, durationType: durationType || 'month',
      description, features: features || [], freeDelivery: freeDelivery || false,
      discountPercent: discountPercent || 0, trialDays: trialDays || 0, isActive: true,
    });
    return sendSuccess(res, 201, 'Plan created', plan);
  } catch (error) {
    next(error);
  }
};

const updatePlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findByPk(req.params.id);
    if (!plan) return sendError(res, 404, 'Plan not found');

    const { name, price, duration, durationType, description, features, freeDelivery, discountPercent, trialDays, isActive } = req.body;
    await plan.update({ name, price, duration, durationType, description, features, freeDelivery, discountPercent, trialDays, isActive });
    return sendSuccess(res, 200, 'Plan updated', plan);
  } catch (error) {
    next(error);
  }
};

const deletePlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findByPk(req.params.id);
    if (!plan) return sendError(res, 404, 'Plan not found');

    await plan.destroy();
    return sendSuccess(res, 200, 'Plan deleted');
  } catch (error) {
    next(error);
  }
};

// ========== WALLET PACKAGES ==========

const createPackage = async (req, res, next) => {
  try {
    const { name, payAmount, creditAmount, description } = req.body;
    if (!name || !payAmount || !creditAmount) return sendError(res, 422, 'Name, payAmount, and creditAmount are required');

    const bonusAmount = parseFloat(creditAmount) - parseFloat(payAmount);
    if (bonusAmount < 0) return sendError(res, 422, 'Credit amount must be >= pay amount');

    const pkg = await WalletPackage.create({
      name, payAmount, creditAmount, bonusAmount, description, isActive: true,
    });
    return sendSuccess(res, 201, 'Package created', pkg);
  } catch (error) {
    next(error);
  }
};

const updatePackage = async (req, res, next) => {
  try {
    const pkg = await WalletPackage.findByPk(req.params.id);
    if (!pkg) return sendError(res, 404, 'Package not found');

    const { name, payAmount, creditAmount, description, isActive } = req.body;
    const bonusAmount = creditAmount && payAmount ? parseFloat(creditAmount) - parseFloat(payAmount) : pkg.bonusAmount;
    await pkg.update({ name, payAmount, creditAmount, bonusAmount, description, isActive });
    return sendSuccess(res, 200, 'Package updated', pkg);
  } catch (error) {
    next(error);
  }
};

const deletePackage = async (req, res, next) => {
  try {
    const pkg = await WalletPackage.findByPk(req.params.id);
    if (!pkg) return sendError(res, 404, 'Package not found');

    await pkg.destroy();
    return sendSuccess(res, 200, 'Package deleted');
  } catch (error) {
    next(error);
  }
};

// ========== PROMO CODES ==========

const createPromo = async (req, res, next) => {
  try {
    const { code, title, description, discountType, discountValue, maxDiscount, minOrderAmount, validDays, usageLimit, usagePerUser, isUserSpecific, isNewUserOnly, imageUrl } = req.body;
    if (!code || !title || !discountValue) return sendError(res, 422, 'Code, title, and discountValue are required');

    const exists = await PromoCode.findOne({ where: { code: code.toUpperCase() } });
    if (exists) return sendError(res, 409, 'Promo code already exists');

    const now = new Date();
    const validUntil = new Date(now.getTime() + (parseInt(validDays) || 30) * 24 * 60 * 60 * 1000);

    const promo = await PromoCode.create({
      code: code.toUpperCase(),
      title,
      description,
      discountType: discountType || 'percentage',
      discountValue: parseFloat(discountValue),
      maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
      minOrderAmount: parseFloat(minOrderAmount) || 0,
      validFrom: now,
      validUntil,
      usageLimit: usageLimit ? parseInt(usageLimit) : null,
      usagePerUser: parseInt(usagePerUser) || 1,
      isUserSpecific: isUserSpecific || false,
      isNewUserOnly: isNewUserOnly || false,
      imageUrl,
      isActive: true,
    });
    return sendSuccess(res, 201, 'Promo code created', promo);
  } catch (error) {
    next(error);
  }
};

const updatePromo = async (req, res, next) => {
  try {
    const promo = await PromoCode.findByPk(req.params.id);
    if (!promo) return sendError(res, 404, 'Promo code not found');

    const { title, description, discountType, discountValue, maxDiscount, minOrderAmount, validUntil, usageLimit, usagePerUser, isActive, isNewUserOnly } = req.body;
    await promo.update({
      title, description, discountType, discountValue, maxDiscount, minOrderAmount, validUntil, usageLimit, usagePerUser, isActive, isNewUserOnly,
    });
    return sendSuccess(res, 200, 'Promo code updated', promo);
  } catch (error) {
    next(error);
  }
};

const deletePromo = async (req, res, next) => {
  try {
    const promo = await PromoCode.findByPk(req.params.id);
    if (!promo) return sendError(res, 404, 'Promo code not found');

    await promo.destroy();
    return sendSuccess(res, 200, 'Promo code deleted');
  } catch (error) {
    next(error);
  }
};

// ========== SERVICEABLE PINCODES ==========

const createPincode = async (req, res, next) => {
  try {
    const { pincode, city, state, area, deliveryDays, minimumOrder, locationId } = req.body;
    if (!pincode || !city) return sendError(res, 422, 'Pincode and city are required');
    if (locationId && !(await Location.findByPk(locationId))) return sendError(res, 404, 'Location not found');

    const exists = await ServiceablePincode.findOne({ where: { pincode } });
    if (exists) return sendError(res, 409, 'Pincode already exists');

    const record = await ServiceablePincode.create({
      pincode, city, state, area,
      locationId: locationId || null,
      deliveryDays: parseInt(deliveryDays) || 2,
      minimumOrder: parseFloat(minimumOrder) || 99,
      isActive: true,
    });
    return sendSuccess(res, 201, 'Pincode added', record);
  } catch (error) {
    next(error);
  }
};

const updatePincode = async (req, res, next) => {
  try {
    const record = await ServiceablePincode.findByPk(req.params.id);
    if (!record) return sendError(res, 404, 'Pincode not found');

    const { pincode, city, state, area, deliveryDays, minimumOrder, isActive, locationId } = req.body;
    if (locationId && !(await Location.findByPk(locationId))) return sendError(res, 404, 'Location not found');
    const changes = { pincode, city, state, area, deliveryDays, minimumOrder, isActive };
    if (locationId !== undefined) changes.locationId = locationId || null;
    await record.update(changes);
    return sendSuccess(res, 200, 'Pincode updated', record);
  } catch (error) {
    next(error);
  }
};

const deletePincode = async (req, res, next) => {
  try {
    const record = await ServiceablePincode.findByPk(req.params.id);
    if (!record) return sendError(res, 404, 'Pincode not found');

    await record.destroy();
    return sendSuccess(res, 200, 'Pincode deleted');
  } catch (error) {
    next(error);
  }
};

// ========== CONTENT PAGES (Terms, Privacy, Disclaimer) ==========

const createContent = async (req, res, next) => {
  try {
    const { slug, title, content } = req.body;
    if (!slug || !title || !content) return sendError(res, 422, 'Slug, title, and content are required');

    const exists = await Content.findOne({ where: { slug } });
    if (exists) return sendError(res, 409, 'Content with this slug already exists');

    const record = await Content.create({ slug, title, content, isActive: true });
    return sendSuccess(res, 201, 'Content created', record);
  } catch (error) {
    next(error);
  }
};

const updateContent = async (req, res, next) => {
  try {
    const record = await Content.findByPk(req.params.id);
    if (!record) return sendError(res, 404, 'Content not found');

    const { title, content, isActive } = req.body;
    await record.update({ title, content, isActive });
    return sendSuccess(res, 200, 'Content updated', record);
  } catch (error) {
    next(error);
  }
};

const deleteContent = async (req, res, next) => {
  try {
    const record = await Content.findByPk(req.params.id);
    if (!record) return sendError(res, 404, 'Content not found');

    await record.destroy();
    return sendSuccess(res, 200, 'Content deleted');
  } catch (error) {
    next(error);
  }
};

// ========== FAQs ==========

const createFaq = async (req, res, next) => {
  try {
    const { question, answer, category } = req.body;
    if (!question || !answer) return sendError(res, 422, 'Question and answer are required');

    const maxOrder = await FAQ.max('sortOrder') || 0;
    const faq = await FAQ.create({ question, answer, category, sortOrder: maxOrder + 1, isActive: true });
    return sendSuccess(res, 201, 'FAQ created', faq);
  } catch (error) {
    next(error);
  }
};

const updateFaq = async (req, res, next) => {
  try {
    const faq = await FAQ.findByPk(req.params.id);
    if (!faq) return sendError(res, 404, 'FAQ not found');

    const { question, answer, category, sortOrder, isActive } = req.body;
    await faq.update({ question, answer, category, sortOrder, isActive });
    return sendSuccess(res, 200, 'FAQ updated', faq);
  } catch (error) {
    next(error);
  }
};

const deleteFaq = async (req, res, next) => {
  try {
    const faq = await FAQ.findByPk(req.params.id);
    if (!faq) return sendError(res, 404, 'FAQ not found');

    await faq.destroy();
    return sendSuccess(res, 200, 'FAQ deleted');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCategory, updateCategory, deleteCategory,
  createSubCategory, updateSubCategory, deleteSubCategory,
  createItem, updateItem, deleteItem,
  createPlan, updatePlan, deletePlan,
  createPackage, updatePackage, deletePackage,
  createPromo, updatePromo, deletePromo,
  createPincode, updatePincode, deletePincode,
  createContent, updateContent, deleteContent,
  createFaq, updateFaq, deleteFaq,
};
