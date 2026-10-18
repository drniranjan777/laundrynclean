const { Content, FAQ } = require('../models/content.model');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/v1/content/:slug
 * Get content page by slug (terms, privacy, disclaimer, about)
 */
const getContentBySlug = async (req, res, next) => {
  try {
    const content = await Content.findOne({
      where: { slug: req.params.slug, isActive: true },
      attributes: ['title', 'content', 'updated_at'],
    });

    if (!content) return sendError(res, 404, 'Content not found');
    return sendSuccess(res, 200, 'Content fetched', content);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/content/faq
 * Get all FAQs
 */
const getFAQs = async (req, res, next) => {
  try {
    const { category } = req.query;
    const where = { isActive: true };
    if (category) where.category = category;

    const faqs = await FAQ.findAll({
      where,
      order: [['sortOrder', 'ASC']],
      attributes: ['id', 'question', 'answer', 'category'],
    });

    return sendSuccess(res, 200, 'FAQs fetched', faqs);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/content/disclaimer
 * Get the delivery disclaimer content
 */
const getDisclaimer = async (req, res, next) => {
  try {
    const disclaimer = await Content.findOne({
      where: { slug: 'disclaimer', isActive: true },
    });

    if (!disclaimer) {
      // Default disclaimer from UI
      return sendSuccess(res, 200, 'Disclaimer fetched', {
        title: 'Disclaimer',
        content: 'To ensure efficient operations and fair service delivery, we apply a nominal delivery charge for smaller orders. Specifically, if your order includes fewer than 10 clothing items, an additional delivery fee will be added to the total bill. This helps us cover pickup and handling costs for smaller loads.',
        deliveryFee: 50,
        minItemsFreeDelivery: 10,
        minAmountFreeDelivery: 250,
      });
    }

    return sendSuccess(res, 200, 'Disclaimer fetched', disclaimer);
  } catch (error) {
    next(error);
  }
};

module.exports = { getContentBySlug, getFAQs, getDisclaimer };
