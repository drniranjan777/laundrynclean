const User = require('../models/user.model');
const { Wallet, WalletTransaction } = require('../models/wallet.model');
const { sendSuccess, sendError } = require('../utils/response');
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');

/**
 * Credit wallet for a single user
 * POST /api/v1/admin/wallet/credit-user
 */
const creditUser = async (req, res, next) => {
  const { userId, amount, reason } = req.body;
  if (!userId || !amount || !reason) return sendError(res, 422, 'userId, amount, and reason are required');
  if (parseFloat(amount) <= 0) return sendError(res, 422, 'Amount must be greater than 0');

  const t = await sequelize.transaction();
  try {
    const user = await User.findByPk(userId, { transaction: t });
    if (!user) { await t.rollback(); return sendError(res, 404, 'User not found'); }

    // Get or create wallet, then lock it so concurrent credits/debits can't overwrite each other
    await Wallet.findOrCreate({ where: { userId }, defaults: { userId }, transaction: t });
    const wallet = await Wallet.findOne({ where: { userId }, lock: t.LOCK.UPDATE, transaction: t });

    const creditAmount = parseFloat(amount);
    const newBalance = parseFloat(wallet.balance) + creditAmount;
    wallet.balance = newBalance;
    wallet.totalCredited = parseFloat(wallet.totalCredited) + creditAmount;
    await wallet.save({ transaction: t });

    await WalletTransaction.create({
      walletId: wallet.id,
      userId,
      type: 'credit',
      amount: creditAmount,
      balanceAfter: newBalance,
      description: `Admin Credit: ${reason}`,
      referenceType: 'admin_credit',
      referenceId: null,
      paymentMethod: null,
    }, { transaction: t });

    await t.commit();

    return sendSuccess(res, 200, 'Wallet credited successfully', {
      userId,
      userName: user.name,
      amountCredited: creditAmount,
      newBalance,
      reason,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * Credit wallet for multiple users (bulk)
 * POST /api/v1/admin/wallet/credit-bulk
 * target: "all" | "new_users" | "by_date" | "by_ids"
 */
const creditBulk = async (req, res, next) => {
  const { amount, reason, target, userIds, daysJoined, fromDate, toDate } = req.body;
  if (!amount || !reason || !target) return sendError(res, 422, 'amount, reason, and target are required');
  if (parseFloat(amount) <= 0) return sendError(res, 422, 'Amount must be greater than 0');

  const t = await sequelize.transaction();
  try {
    // Determine which users to credit
    let where = { role: 'customer', isActive: true };

    switch (target) {
      case 'all':
        // All active customers
        break;
      case 'new_users':
        // Users who joined within last X days (default 7)
        const days = parseInt(daysJoined) || 7;
        where.created_at = { [Op.gte]: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
        break;
      case 'by_date':
        // Users who joined between fromDate and toDate
        if (!fromDate || !toDate) { await t.rollback(); return sendError(res, 422, 'fromDate and toDate required for by_date target'); }
        where.created_at = { [Op.between]: [new Date(fromDate), new Date(toDate + 'T23:59:59')] };
        break;
      case 'by_ids':
        // Specific user IDs
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) { await t.rollback(); return sendError(res, 422, 'userIds array is required'); }
        where.id = { [Op.in]: userIds };
        break;
      default:
        await t.rollback();
        return sendError(res, 422, 'Invalid target. Use: all, new_users, by_date, by_ids');
    }

    // Ordered by id so concurrent bulk credits lock wallets in the same order (no deadlocks)
    const users = await User.findAll({ where, attributes: ['id', 'name'], order: [['id', 'ASC']], transaction: t });

    if (users.length === 0) {
      await t.rollback();
      return sendError(res, 404, 'No users found matching the criteria');
    }

    const creditAmount = parseFloat(amount);
    let creditedCount = 0;

    for (const user of users) {
      // Get or create wallet, then lock it
      await Wallet.findOrCreate({ where: { userId: user.id }, defaults: { userId: user.id }, transaction: t });
      const wallet = await Wallet.findOne({ where: { userId: user.id }, lock: t.LOCK.UPDATE, transaction: t });

      const newBalance = parseFloat(wallet.balance) + creditAmount;
      wallet.balance = newBalance;
      wallet.totalCredited = parseFloat(wallet.totalCredited) + creditAmount;
      await wallet.save({ transaction: t });

      await WalletTransaction.create({
        walletId: wallet.id,
        userId: user.id,
        type: 'credit',
        amount: creditAmount,
        balanceAfter: newBalance,
        description: `Admin Credit: ${reason}`,
        referenceType: 'admin_credit',
        referenceId: null,
        paymentMethod: null,
      }, { transaction: t });

      creditedCount++;
    }

    await t.commit();

    return sendSuccess(res, 200, `Wallet credited to ${creditedCount} users`, {
      creditedCount,
      amountPerUser: creditAmount,
      totalAmount: creditAmount * creditedCount,
      reason,
      target,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * Get admin credit history
 * GET /api/v1/admin/wallet/credit-history
 */
const getCreditHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows, count } = await WalletTransaction.findAndCountAll({
      where: { referenceType: 'admin_credit' },
      include: [{
        model: Wallet,
        as: 'Wallet',
        attributes: [],
      }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
      raw: true,
    });

    // Get user names for each transaction
    const transactionsWithUsers = await Promise.all(rows.map(async (txn) => {
      const user = await User.findByPk(txn.userId || txn.user_id, { attributes: ['id', 'name', 'phone'] });
      return {
        id: txn.id,
        userId: txn.userId || txn.user_id,
        userName: user?.name || 'Unknown',
        userPhone: user?.phone || '',
        type: txn.type,
        amount: parseFloat(txn.amount),
        description: txn.description,
        createdAt: txn.created_at,
      };
    }));

    return sendSuccess(res, 200, 'Credit history fetched', {
      transactions: transactionsWithUsers,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Debit wallet for a single user (reverse mistaken credit)
 * POST /api/v1/admin/wallet/debit-user
 */
const debitUser = async (req, res, next) => {
  const { userId, amount, reason } = req.body;
  if (!userId || !amount || !reason) return sendError(res, 422, 'userId, amount, and reason are required');
  if (parseFloat(amount) <= 0) return sendError(res, 422, 'Amount must be greater than 0');

  const t = await sequelize.transaction();
  try {
    const user = await User.findByPk(userId, { transaction: t });
    if (!user) { await t.rollback(); return sendError(res, 404, 'User not found'); }

    // Lock the wallet so the balance check and the debit see the same balance
    const wallet = await Wallet.findOne({ where: { userId }, lock: t.LOCK.UPDATE, transaction: t });
    if (!wallet) { await t.rollback(); return sendError(res, 404, 'User has no wallet'); }

    const debitAmount = parseFloat(amount);
    const currentBalance = parseFloat(wallet.balance);

    if (debitAmount > currentBalance) {
      await t.rollback();
      return sendError(res, 400, `Insufficient balance. User has ₹${currentBalance} but trying to deduct ₹${debitAmount}`);
    }

    const newBalance = currentBalance - debitAmount;
    wallet.balance = newBalance;
    wallet.totalDebited = parseFloat(wallet.totalDebited) + debitAmount;
    await wallet.save({ transaction: t });

    await WalletTransaction.create({
      walletId: wallet.id,
      userId,
      type: 'debit',
      amount: debitAmount,
      balanceAfter: newBalance,
      description: `Admin Debit: ${reason}`,
      referenceType: 'admin_credit', // Same type for history tracking
      referenceId: null,
      paymentMethod: null,
    }, { transaction: t });

    await t.commit();

    return sendSuccess(res, 200, 'Wallet debited successfully', {
      userId,
      userName: user.name,
      amountDebited: debitAmount,
      newBalance,
      reason,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

module.exports = { creditUser, creditBulk, getCreditHistory, debitUser };
