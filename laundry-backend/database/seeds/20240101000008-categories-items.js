'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const garmentId = uuidv4();
    const bedsheetsId = uuidv4();
    const curtainsId = uuidv4();

    await queryInterface.bulkInsert('categories', [
      { id: garmentId, name: 'Garment', slug: 'garment', icon: 'shirt', sort_order: 1, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: bedsheetsId, name: 'Bedsheets', slug: 'bedsheets', icon: 'bed', sort_order: 2, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: curtainsId, name: 'Curtains', slug: 'curtains', icon: 'curtain', sort_order: 3, is_active: true, created_at: new Date(), updated_at: new Date() },
    ]);

    const womanId = uuidv4();
    const manId = uuidv4();
    const kidsId = uuidv4();

    await queryInterface.bulkInsert('sub_categories', [
      { id: womanId, category_id: garmentId, name: 'Woman', slug: 'woman', color: '#E8A87C', sort_order: 1, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: manId, category_id: garmentId, name: 'Man', slug: 'man', color: '#E27D60', sort_order: 2, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: kidsId, category_id: garmentId, name: 'Kids', slug: 'kids', color: '#85CDCA', sort_order: 3, is_active: true, created_at: new Date(), updated_at: new Date() },
    ]);

    await queryInterface.bulkInsert('items', [
      // Woman garments
      { id: uuidv4(), category_id: garmentId, sub_category_id: womanId, name: 'Blazers', brand: null, price: 120, original_price: 150, discount_percent: 20, colors: JSON.stringify(['Black', 'Navy']), sizes: JSON.stringify(['S', 'M', 'L']), is_limited_offer: true, sort_order: 1, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), category_id: garmentId, sub_category_id: womanId, name: 'Pants', brand: 'Dorothy Perkins', price: 50, original_price: null, discount_percent: 0, colors: JSON.stringify(['Blue', 'Black']), sizes: JSON.stringify(['S', 'M', 'L', 'XL']), sort_order: 2, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), category_id: garmentId, sub_category_id: womanId, name: 'T-shirt', brand: 'LOST Ink', price: 50, original_price: null, discount_percent: 0, avg_rating: 5.0, review_count: 10, colors: JSON.stringify(['Gray', 'White']), sizes: JSON.stringify(['S', 'M', 'L']), sort_order: 3, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), category_id: garmentId, sub_category_id: womanId, name: 'Shirts', brand: null, price: 40, original_price: null, discount_percent: 0, colors: JSON.stringify(['White', 'Pink']), sizes: JSON.stringify(['S', 'M', 'L']), sort_order: 4, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), category_id: garmentId, sub_category_id: womanId, name: 'Knitwear', brand: null, price: 80, original_price: null, discount_percent: 0, sort_order: 5, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), category_id: garmentId, sub_category_id: womanId, name: 'Skirts', brand: null, price: 45, original_price: null, discount_percent: 0, sort_order: 6, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), category_id: garmentId, sub_category_id: womanId, name: 'Dresses', brand: null, price: 100, original_price: null, discount_percent: 0, sort_order: 7, is_active: true, created_at: new Date(), updated_at: new Date() },
      // Man garments
      { id: uuidv4(), category_id: garmentId, sub_category_id: manId, name: 'Shirt', brand: 'Topshop', price: 50, original_price: null, discount_percent: 0, is_add_on: true, colors: JSON.stringify(['Black', 'White', 'Blue']), sizes: JSON.stringify(['M', 'L', 'XL']), sort_order: 1, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), category_id: garmentId, sub_category_id: manId, name: 'T-Shirt', brand: null, price: 40, original_price: null, discount_percent: 0, colors: JSON.stringify(['Gray', 'Black']), sizes: JSON.stringify(['M', 'L', 'XL']), sort_order: 2, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), category_id: garmentId, sub_category_id: manId, name: 'Trousers', brand: null, price: 60, original_price: null, discount_percent: 0, colors: JSON.stringify(['Black', 'Navy']), sizes: JSON.stringify(['30', '32', '34', '36']), sort_order: 3, is_active: true, created_at: new Date(), updated_at: new Date() },
      // Bedsheets
      { id: uuidv4(), category_id: bedsheetsId, sub_category_id: null, name: 'Bedsheet', brand: null, price: 250, original_price: null, discount_percent: 0, colors: JSON.stringify(['Black', 'White', 'Blue']), sizes: JSON.stringify(['Single', 'Double/Full', 'King']), sort_order: 1, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), category_id: bedsheetsId, sub_category_id: null, name: 'Pillow Cover', brand: null, price: 30, original_price: null, discount_percent: 0, sort_order: 2, is_active: true, created_at: new Date(), updated_at: new Date() },
      // Curtains
      { id: uuidv4(), category_id: curtainsId, sub_category_id: null, name: 'Window Curtain', brand: null, price: 150, original_price: null, discount_percent: 0, sort_order: 1, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), category_id: curtainsId, sub_category_id: null, name: 'Door Curtain', brand: null, price: 200, original_price: null, discount_percent: 0, sort_order: 2, is_active: true, created_at: new Date(), updated_at: new Date() },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('items', null, {});
    await queryInterface.bulkDelete('sub_categories', null, {});
    await queryInterface.bulkDelete('categories', null, {});
  },
};
