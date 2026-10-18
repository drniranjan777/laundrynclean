const { sendSuccess } = require('../utils/response');
const OnboardingSlide = require('../models/onboarding.model');

/**
 * GET /api/v1/onboarding/slides
 * Get all active onboarding slides in order
 */
const getSlides = async (req, res, next) => {
  try {
    const slides = await OnboardingSlide.findAll({
      where: { isActive: true },
      order: [['sortOrder', 'ASC']],
      attributes: ['id', 'title', 'description', 'mediaUrl', 'mediaType', 'sortOrder'],
    });

    return sendSuccess(res, 200, 'Onboarding slides fetched', slides);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/onboarding/app-config
 * Get app configuration (version, force update, maintenance mode, etc.)
 */
const getAppConfig = async (req, res, next) => {
  try {
    const config = {
      appName: 'NClean',
      tagline: 'Premium Ironing, Delivered to Your Door',
      minimumAppVersion: '1.0.0',
      latestAppVersion: '1.0.0',
      forceUpdate: false,
      maintenanceMode: false,
      supportPhone: '+919999999999',
      supportEmail: 'support@tallygen.com',
      termsUrl: 'https://istreecare.com/terms',
      privacyUrl: 'https://istreecare.com/privacy',
    };

    return sendSuccess(res, 200, 'App config fetched', config);
  } catch (error) {
    next(error);
  }
};

module.exports = { getSlides, getAppConfig };
