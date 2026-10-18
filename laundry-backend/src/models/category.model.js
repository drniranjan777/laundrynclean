const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Top-level categories: Garment, Bedsheets, Curtains
const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false, // Garment, Bedsheets, Curtains
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  icon: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'image_url',
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'sort_order',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
}, {
  tableName: 'categories',
  timestamps: true,
});

// Sub-categories: Woman, Man, Kids, Special
const SubCategory = sequelize.define('SubCategory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  categoryId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'category_id',
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false, // Woman, Man, Kids
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  color: {
    type: DataTypes.STRING,
    allowNull: true, // Chip color in UI
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'sort_order',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
}, {
  tableName: 'sub_categories',
  timestamps: true,
});

// Items: Shirts, Blazers, Pants, T-shirt, etc.
const Item = sequelize.define('Item', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  categoryId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'category_id',
  },
  subCategoryId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'sub_category_id',
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  brand: {
    type: DataTypes.STRING,
    allowNull: true, // Dorothy Perkins, Topshop, LOST Ink
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'image_url',
  },
  icon: {
    type: DataTypes.STRING(40),
    allowNull: true, // Key from the admin panel's cloth icon library, e.g. 'shirt'; null = picked from the name
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  originalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'original_price', // If discounted, shows strikethrough price
  },
  discountPercent: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'discount_percent', // e.g., 20 for -20%
  },
  colors: {
    type: DataTypes.JSONB,
    allowNull: true, // ["Black", "Gray", "White"]
  },
  sizes: {
    type: DataTypes.JSONB,
    allowNull: true, // ["S", "M", "L", "XL", "Double/Full"]
  },
  avgRating: {
    type: DataTypes.DECIMAL(2, 1),
    defaultValue: 0,
    field: 'avg_rating',
  },
  reviewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'review_count',
  },
  isAddOn: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_add_on', // "Add On" badge
  },
  isLimitedOffer: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_limited_offer', // "Limited Time Offer" badge
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'sort_order',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
}, {
  tableName: 'items',
  timestamps: true,
});

// Relationships
Category.hasMany(SubCategory, { foreignKey: 'category_id', as: 'subCategories' });
SubCategory.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

Category.hasMany(Item, { foreignKey: 'category_id', as: 'items' });
SubCategory.hasMany(Item, { foreignKey: 'sub_category_id', as: 'items' });
Item.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Item.belongsTo(SubCategory, { foreignKey: 'sub_category_id', as: 'subCategory' });

module.exports = { Category, SubCategory, Item };
