const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// User Wallet - stores balance
const Wallet = sequelize.define('Wallet', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    field: 'user_id',
  },
  balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  totalCredited: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'total_credited',
  },
  totalDebited: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'total_debited',
  },
}, {
  tableName: 'wallets',
  timestamps: true,
});

// Wallet Packages - admin creates (e.g., Pay 500, get 600)
const WalletPackage = sequelize.define('WalletPackage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  payAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'pay_amount', // Amount user pays
  },
  creditAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'credit_amount', // Amount credited to wallet (includes bonus)
  },
  bonusAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'bonus_amount', // Bonus = creditAmount - payAmount
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'sort_order',
  },
}, {
  tableName: 'wallet_packages',
  timestamps: true,
});

// Wallet Transactions - credit/debit history
const WalletTransaction = sequelize.define('WalletTransaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  walletId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'wallet_id',
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
  },
  type: {
    type: DataTypes.ENUM('credit', 'debit'),
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  balanceAfter: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'balance_after',
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  referenceType: {
    type: DataTypes.ENUM('recharge', 'package_bonus', 'order_payment', 'refund', 'admin_credit'),
    allowNull: false,
    field: 'reference_type',
  },
  referenceId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'reference_id', // orderId or packageId
  },
  paymentMethod: {
    type: DataTypes.ENUM('card', 'upi', 'wallet', 'paypal', 'cash'),
    allowNull: true,
    field: 'payment_method',
  },
  paymentTransactionId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'payment_transaction_id',
  },
}, {
  tableName: 'wallet_transactions',
  timestamps: true,
});

Wallet.hasMany(WalletTransaction, { foreignKey: 'wallet_id', as: 'transactions' });
WalletTransaction.belongsTo(Wallet, { foreignKey: 'wallet_id' });

module.exports = { Wallet, WalletPackage, WalletTransaction };
