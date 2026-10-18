const Notification = require('../models/notification.model');

const createNotification = async (userId, { title, body, type }) => {
  const notification = await Notification.create({
    userId,
    title,
    body,
    type,
  });
  return notification;
};

const sendPushNotification = async (userId, { title, body }) => {
  // TODO: Integrate with Firebase Cloud Messaging
  console.log(`Push notification sent to user ${userId}: ${title}`);
};

const getUserNotifications = async (userId, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  const notifications = await Notification.findAll({
    where: { userId },
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });
  return notifications;
};

module.exports = { createNotification, sendPushNotification, getUserNotifications };
