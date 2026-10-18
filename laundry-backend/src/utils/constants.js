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
    READY_FOR_PICKUP: 'ready_for_pickup',
    COLLECTED: 'collected',
    CANCELLED: 'cancelled',
  },

  // Allowed booking status changes, shared by the staff and driver status endpoints.
  // New / received (pending, confirmed) → picked up from the customer (online) or received at the shop →
  // in_process → ready → either delivered (out_for_delivery → delivered) or collected at the shop
  // (ready_for_pickup → collected). Delivered, collected and cancelled are final.
  // Staff set delivered / collected only through the confirm endpoints, which record the handover.
  ORDER_STATUS_TRANSITIONS: {
    pending: ['confirmed', 'pickup_scheduled', 'cancelled'],
    confirmed: ['pickup_scheduled', 'picked_up', 'in_process', 'cancelled'], // in_process: clothes received at the shop
    pickup_scheduled: ['picked_up', 'cancelled'],
    picked_up: ['in_process', 'cancelled'],
    in_process: ['ready', 'cancelled'],
    ready: ['out_for_delivery', 'ready_for_pickup', 'cancelled'],
    out_for_delivery: ['delivered', 'ready', 'cancelled'], // back to ready after a failed delivery
    ready_for_pickup: ['collected', 'ready', 'cancelled'], // back to ready to deliver it after all
    delivered: [],
    collected: [],
    cancelled: [],
  },

  // Moves back that need a reason, recorded in the order history
  ORDER_STATUS_BACKWARD: ['out_for_delivery>ready', 'ready_for_pickup>ready'],

  // Admin-only corrections of a mistaken status (with a reason, recorded as a correction in the history)
  ORDER_STATUS_CORRECTIONS: {
    delivered: ['out_for_delivery'],
    collected: ['ready_for_pickup'],
    ready: ['in_process'],
    ready_for_pickup: ['ready'],
    out_for_delivery: ['ready'],
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
