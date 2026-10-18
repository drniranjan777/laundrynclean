'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('onboarding_slides', [
      {
        id: uuidv4(),
        title: 'Well-Trained Professionals',
        description: 'A wide range of experienced Service Providers to serve laundry services. We check their backgrounds in details.',
        media_url: 'https://assets.istreecare.com/onboarding/professionals.mp4',
        media_type: 'video',
        sort_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        title: 'Doorstep Pickup & Delivery',
        description: 'Schedule a pickup at your convenience. Our delivery partner will collect and return your clothes right at your doorstep.',
        media_url: 'https://assets.istreecare.com/onboarding/pickup.jpg',
        media_type: 'image',
        sort_order: 2,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        title: 'Premium Ironing Quality',
        description: 'We use modern equipment and trained staff to deliver crisp, wrinkle-free clothes every single time.',
        media_url: 'https://assets.istreecare.com/onboarding/quality.jpg',
        media_type: 'image',
        sort_order: 3,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('onboarding_slides', null, {});
  },
};
