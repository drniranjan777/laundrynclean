'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('contents', [
      { id: uuidv4(), slug: 'terms', title: 'Terms & Conditions', content: 'These are the terms and conditions for NClean. By using our services, you agree to the following terms...', is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), slug: 'privacy', title: 'Privacy Policy', content: 'Your privacy is important to us. This policy explains how we collect, use, and protect your personal data...', is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), slug: 'disclaimer', title: 'Disclaimer', content: 'To ensure efficient operations and fair service delivery, we apply a nominal delivery charge for smaller orders. Specifically, if your order includes fewer than 10 clothing items, an additional delivery fee will be added to the total bill. This helps us cover pickup and handling costs for smaller loads.', is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), slug: 'about', title: 'About NClean', content: 'NClean is a premium ironing and laundry service delivered to your door. We employ well-trained professionals to ensure the best quality service.', is_active: true, created_at: new Date(), updated_at: new Date() },
    ]);

    await queryInterface.bulkInsert('faqs', [
      { id: uuidv4(), question: 'How do I place an order?', answer: 'Simply browse our categories, add items to your bag, select a pickup date and time slot, and confirm your order.', category: 'Orders', sort_order: 1, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), question: 'What are the delivery charges?', answer: 'Orders above ₹250 or with 10+ items enjoy free delivery. For smaller orders, a nominal ₹50 delivery fee applies.', category: 'Delivery', sort_order: 2, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), question: 'How long does it take to deliver?', answer: 'We typically deliver within 2 days of pickup. Express delivery is available for Platinum subscribers.', category: 'Delivery', sort_order: 3, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), question: 'How do I add money to my wallet?', answer: 'Go to Wallet section, enter amount or select a package, choose payment method and add money. Packages offer bonus credit!', category: 'Payment', sort_order: 4, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), question: 'Can I cancel my order?', answer: 'Yes, you can cancel before the pickup is initiated. Go to My Orders and tap Cancel.', category: 'Orders', sort_order: 5, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), question: 'How do subscription plans work?', answer: 'Choose a plan (Basic/Starter/Standard/Platinum) to get monthly benefits like free delivery, discounts, and priority pickup.', category: 'Subscription', sort_order: 6, is_active: true, created_at: new Date(), updated_at: new Date() },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('faqs', null, {});
    await queryInterface.bulkDelete('contents', null, {});
  },
};
