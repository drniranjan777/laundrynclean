const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { Item } = require('./category.model');

const CartItem = sequelize.define('CartItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
  },
  itemId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'item_id',
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  color: {
    type: DataTypes.STRING,
    allowNull: true, // Selected color
  },
  size: {
    type: DataTypes.STRING,
    allowNull: true, // Selected size
  },
}, {
  tableName: 'cart_items',
  timestamps: true,
});

const Favorite = sequelize.define('Favorite', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
  },
  itemId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'item_id',
  },
}, {
  tableName: 'favorites',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['user_id', 'item_id'] },
  ],
});

CartItem.belongsTo(Item, { foreignKey: 'item_id', as: 'item' });
Favorite.belongsTo(Item, { foreignKey: 'item_id', as: 'item' });

module.exports = { CartItem, Favorite };
