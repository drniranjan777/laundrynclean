'use strict';

// Catalogue items can pick an icon from the admin panel's cloth icon library (a key such as 'shirt' or 'saree').
// NULL = the admin panel picks one from the item's name, as before.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE items ADD COLUMN IF NOT EXISTS icon VARCHAR(40)');
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE items DROP COLUMN IF EXISTS icon');
  },
};
