module.exports = {
  ROLES: {
    CUSTOMER: 'customer',
    DRIVER: 'driver',
    ADMIN: 'admin',
  },

  ORDER_STATUS: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PICKUP_SCHEDULED: 'pickup_scheduled',
    PICKED_UP: 'picked_up',
    IN_PROCESS: 'in_process',
    READY: 'ready',
    OUT_FOR_DELIVERY: 'out_for_delivery',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
  },

  // Allowed booking status changes, shared by the admin and driver status endpoints.
  // Orders only move forward; delivered and cancelled are final.
  ORDER_STATUS_TRANSITIONS: {
    pending: ['confirmed', 'pickup_scheduled', 'cancelled'],
    confirmed: ['pickup_scheduled', 'picked_up', 'cancelled'],
    pickup_scheduled: ['picked_up', 'cancelled'],
    picked_up: ['in_process', 'cancelled'],
    in_process: ['ready', 'out_for_delivery', 'cancelled'],
    ready: ['out_for_delivery', 'delivered', 'cancelled'],
    out_for_delivery: ['delivered', 'ready', 'cancelled'], // back to ready after a failed delivery
    delivered: [],
    cancelled: [],
  },

  PAYMENT_STATUS: {
    PENDING: 'pending',
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded',
  },

  PICKUP_STATUS: {
    SCHEDULED: 'scheduled',
    ASSIGNED: 'assigned',
    EN_ROUTE: 'en_route',
    PICKED_UP: 'picked_up',
    CANCELLED: 'cancelled',
  },

  PAYMENT_METHODS: {
    CARD: 'card',
    UPI: 'upi',
    WALLET: 'wallet',
    COD: 'cod',
  },
};
