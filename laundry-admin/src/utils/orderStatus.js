// Order statuses as the admin panel shows them, and the moves the backend allows (it enforces them; these only
// decide which buttons and options to offer).

export const STATUS_META = {
  pending: { label: 'Pending', badge: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmed', badge: 'bg-blue-100 text-blue-700' },
  pickup_scheduled: { label: 'Pickup scheduled', badge: 'bg-indigo-100 text-indigo-700' },
  picked_up: { label: 'Picked up', badge: 'bg-indigo-100 text-indigo-700' },
  in_process: { label: 'In process', badge: 'bg-sky-100 text-sky-700' },
  ready: { label: 'Ready', badge: 'bg-teal-100 text-teal-700' },
  out_for_delivery: { label: 'Out for delivery', badge: 'bg-orange-100 text-orange-700' },
  delivered: { label: 'Delivered', badge: 'bg-green-100 text-green-700' },
  ready_for_pickup: { label: 'Ready for pickup', badge: 'bg-purple-100 text-purple-700' },
  collected: { label: 'Collected', badge: 'bg-slate-200 text-slate-700' },
  cancelled: { label: 'Cancelled', badge: 'bg-red-100 text-red-700' },
};

export const STATUS_ORDER = ['pending', 'confirmed', 'pickup_scheduled', 'picked_up', 'in_process', 'ready', 'out_for_delivery', 'delivered', 'ready_for_pickup', 'collected', 'cancelled'];

// Same as ORDER_STATUS_TRANSITIONS in the backend (laundry-backend/src/utils/constants.js)
export const TRANSITIONS = {
  pending: ['confirmed', 'pickup_scheduled', 'cancelled'],
  confirmed: ['pickup_scheduled', 'picked_up', 'in_process', 'cancelled'],
  pickup_scheduled: ['picked_up', 'cancelled'],
  picked_up: ['in_process', 'cancelled'],
  in_process: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'ready_for_pickup', 'cancelled'],
  out_for_delivery: ['delivered', 'ready', 'cancelled'],
  ready_for_pickup: ['collected', 'ready', 'cancelled'],
  delivered: [],
  collected: [],
  cancelled: [],
};

// Admin-only corrections of a mistaken status (ORDER_STATUS_CORRECTIONS in the backend)
export const CORRECTIONS = {
  delivered: ['out_for_delivery'],
  collected: ['ready_for_pickup'],
  ready: ['in_process'],
  ready_for_pickup: ['ready'],
  out_for_delivery: ['ready'],
};

const BACKWARD = new Set(['out_for_delivery>ready', 'ready_for_pickup>ready']);

export const statusLabel = (status) => STATUS_META[status]?.label || (status || '').replace(/_/g, ' ');
export const statusBadge = (status) => STATUS_META[status]?.badge || 'bg-gray-100 text-gray-600';

/** Cancelling and sending an order back to Ready need a reason */
export const needsReason = (from, to) => to === 'cancelled' || BACKWARD.has(`${from}>${to}`);

/**
 * Cash still due on an order: unpaid cash-on-delivery or pay-later store orders, and billed bulk pickups the
 * customer hasn't paid online yet (same rule as the backend's cashDue)
 */
export const cashDue = (booking) => (booking.paymentStatus !== 'paid' && (booking.paymentMethod === 'cod' || booking.bookingType === 'bulk_pickup')
  ? Number(booking.total)
  : 0);

export const paymentBadge = (booking) => {
  if (booking.paymentStatus === 'paid') return { text: 'Paid', className: 'bg-green-50 text-green-700' };
  if (booking.paymentStatus === 'refunded') return { text: 'Refunded', className: 'bg-gray-100 text-gray-600' };
  if (booking.bookingType === 'bulk_pickup' && !(Number(booking.total) > 0)) {
    return { text: booking.paymentMethod === 'cod' ? 'COD · billed after pickup' : 'Online · billed after pickup', className: 'bg-gray-100 text-gray-600' };
  }
  if (cashDue(booking) > 0) return { text: `Cash due ${rupees(booking.total)}`, className: 'bg-amber-50 text-amber-700' };
  return { text: 'Payment pending', className: 'bg-amber-50 text-amber-700' };
};

/** ₹580 for whole rupees, ₹141.60 otherwise */
export const rupees = (amount) => {
  const n = Number(amount) || 0;
  return `₹${Number.isInteger(n) ? n : n.toFixed(2)}`;
};

export const formatDateTime = (iso) => (iso
  ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '—');

export const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** Value for a datetime-local input (local time, minutes) */
export const toLocalInput = (date = new Date()) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
