const { Wallet, WalletPackage, WalletTransaction } = require('../models/wallet.model');
const { sendSuccess, sendError } = require('../utils/response');
const { sequelize } = require('../config/db');
const paymentService = require('../services/payment.service');

/**
 * GET /api/v1/wallet
 * Get wallet balance and summary
 */
const getWallet = async (req, res, next) => {
  try {
    let wallet = await Wallet.findOne({ where: { userId: req.user.id } });

    // Auto-create wallet if not exists
    if (!wallet) {
      wallet = await Wallet.create({ userId: req.user.id });
    }

    return sendSuccess(res, 200, 'Wallet fetched', {
      id: wallet.id,
      balance: parseFloat(wallet.balance),
      totalCredited: parseFloat(wallet.totalCredited),
      totalDebited: parseFloat(wallet.totalDebited),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/wallet/transactions
 * Get wallet transaction history
 */
const getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = { userId: req.user.id };
    if (type) where.type = type;

    const { rows, count } = await WalletTransaction.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    return sendSuccess(res, 200, 'Transactions fetched', {
      transactions: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/wallet/packages
 * Get available wallet recharge packages
 */
const getPackages = async (req, res, next) => {
  try {
    const packages = await WalletPackage.findAll({
      where: { isActive: true },
      order: [['sortOrder', 'ASC'], ['payAmount', 'ASC']],
    });
    return sendSuccess(res, 200, 'Packages fetched', packages);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/wallet/create-order
 * Start a wallet recharge (custom amount or package): creates a Razorpay order.
 * The wallet is only credited after /wallet/add-money verifies the payment.
 */
const createRechargeOrder = async (req, res, next) => {
  try {
    const { amount, packageId } = req.body;

    let payAmount;
    let creditAmount;
    if (packageId) {
      const pkg = await WalletPackage.findByPk(packageId);
      if (!pkg || !pkg.isActive) {
        return sendError(res, 404, 'Package not found or inactive');
      }
      payAmount = parseFloat(pkg.payAmount);
      creditAmount = parseFloat(pkg.creditAmount);
    } else {
      payAmount = Math.round(parseFloat(amount) * 100) / 100;
      creditAmount = payAmount;
    }

    if (!(payAmount >= 1)) {
      return sendError(res, 422, 'Amount must be at least ₹1');
    }

    // Notes are set here by the server and can be trusted when the payment is verified
    const payment = await paymentService.createOrder({
      amount: payAmount,
      receipt: `wallet-${Date.now()}`,
      notes: {
        purpose: 'wallet_recharge',
        userId: req.user.id,
        packageId: packageId || '',
        payAmount: String(payAmount),
        creditAmount: String(creditAmount),
      },
    });

    return sendSuccess(res, 201, 'Recharge order created', {
      ...payment,
      amountToPay: payAmount,
      amountToCredit: creditAmount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/wallet/add-money
 * Verify a Razorpay payment for a recharge order and credit the wallet
 */
const addMoney = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { razorpayOrderId, razorpayPaymentId, paymentMethod } = req.body;

    const order = await paymentService.verifyPaidOrder(req.body);
    const notes = order.notes || {};
    if (notes.purpose !== 'wallet_recharge' || notes.userId !== req.user.id) {
      await t.rollback();
      return sendError(res, 400, 'Payment does not belong to this wallet');
    }

    const payAmount = parseFloat(notes.payAmount);
    const creditAmount = parseFloat(notes.creditAmount);
    if (order.amount !== paymentService.toPaise(payAmount)) {
      await t.rollback();
      return sendError(res, 400, 'Paid amount does not match the recharge order');
    }
    const bonusAmount = Math.round((creditAmount - payAmount) * 100) / 100;
    const packageId = notes.packageId || null;

    // Get or create wallet, then lock it so the same payment can't be credited twice
    await Wallet.findOrCreate({ where: { userId: req.user.id }, defaults: { userId: req.user.id }, transaction: t });
    const wallet = await Wallet.findOne({ where: { userId: req.user.id }, lock: t.LOCK.UPDATE, transaction: t });

    const alreadyCredited = await WalletTransaction.findOne({
      where: { paymentTransactionId: razorpayPaymentId },
      transaction: t,
    });
    if (alreadyCredited) {
      await t.rollback();
      return sendError(res, 409, 'This payment has already been added to your wallet');
    }

    // Update wallet balance
    const balanceAfterPayment = parseFloat(wallet.balance) + payAmount;
    const newBalance = balanceAfterPayment + bonusAmount;
    wallet.balance = newBalance;
    wallet.totalCredited = parseFloat(wallet.totalCredited) + creditAmount;
    await wallet.save({ transaction: t });

    // Record the paid amount and the bonus separately so the history adds up to the balance
    const transaction = await WalletTransaction.create({
      walletId: wallet.id,
      userId: req.user.id,
      type: 'credit',
      amount: payAmount,
      balanceAfter: balanceAfterPayment,
      description: packageId
        ? `Package: Pay ₹${payAmount}, Get ₹${creditAmount}`
        : `Wallet recharge of ₹${payAmount}`,
      referenceType: 'recharge',
      referenceId: packageId,
      paymentMethod: paymentMethod || 'card',
      paymentTransactionId: razorpayPaymentId,
    }, { transaction: t });

    if (bonusAmount > 0) {
      await WalletTransaction.create({
        walletId: wallet.id,
        userId: req.user.id,
        type: 'credit',
        amount: bonusAmount,
        balanceAfter: newBalance,
        description: `Bonus credit for package recharge`,
        referenceType: 'package_bonus',
        referenceId: packageId,
        paymentMethod: null,
        paymentTransactionId: null,
      }, { transaction: t });
    }

    await t.commit();

    return sendSuccess(res, 200, 'Money added successfully', {
      amountPaid: payAmount,
      amountCredited: creditAmount,
      bonus: bonusAmount,
      newBalance,
      transactionId: transaction.id,
      razorpayOrderId,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * POST /api/v1/wallet/debit (internal use - called by order service)
 * Debit wallet for order payment
 */
const debitWallet = async (userId, amount, orderId, transaction) => {
  // Lock the row so two concurrent orders can't spend the same balance
  const wallet = await Wallet.findOne({ where: { userId }, lock: transaction.LOCK.UPDATE, transaction });
  if (!wallet || parseFloat(wallet.balance) < amount) {
    const error = new Error('Insufficient wallet balance');
    error.statusCode = 400;
    throw error;
  }

  const newBalance = parseFloat(wallet.balance) - amount;
  wallet.balance = newBalance;
  wallet.totalDebited = parseFloat(wallet.totalDebited) + amount;
  await wallet.save({ transaction });

  await WalletTransaction.create({
    walletId: wallet.id,
    userId,
    type: 'debit',
    amount,
    balanceAfter: newBalance,
    description: `Payment for order`,
    referenceType: 'order_payment',
    referenceId: orderId,
  }, { transaction });

  return newBalance;
};

/**
 * Credit an order's payment back to the user's wallet (internal use - called on cancellation)
 */
const refundToWallet = async (userId, amount, orderId, transaction, description = 'Refund for cancelled order') => {
  // Get or create the wallet, then lock it like debitWallet does
  await Wallet.findOrCreate({ where: { userId }, defaults: { userId }, transaction });
  const wallet = await Wallet.findOne({ where: { userId }, lock: transaction.LOCK.UPDATE, transaction });

  const newBalance = Math.round((parseFloat(wallet.balance) + amount) * 100) / 100;
  wallet.balance = newBalance;
  wallet.totalCredited = parseFloat(wallet.totalCredited) + amount;
  await wallet.save({ transaction });

  await WalletTransaction.create({
    walletId: wallet.id,
    userId,
    type: 'credit',
    amount,
    balanceAfter: newBalance,
    description,
    referenceType: 'refund',
    referenceId: orderId,
  }, { transaction });

  return newBalance;
};

module.exports = { getWallet, getTransactions, getPackages, createRechargeOrder, addMoney, debitWallet, refundToWallet };
