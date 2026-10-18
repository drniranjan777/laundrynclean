import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
  HiOutlineClock, HiOutlineClipboardCheck, HiOutlineTruck, HiArrowRight, HiOutlineUserAdd, HiOutlineClipboardList, HiX,
  HiOutlineExclamationCircle, HiOutlineCash, HiOutlineSwitchHorizontal,
} from 'react-icons/hi';
import { MdOutlineDeliveryDining } from 'react-icons/md';

const tabs = [
  { key: 'in_process', label: 'In Process', icon: HiOutlineClock, nextStatus: 'ready', nextLabel: 'Mark Ready' },
  { key: 'ready', label: 'Ready', icon: HiOutlineClipboardCheck, nextStatus: 'out_for_delivery', nextLabel: 'Out for Delivery' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: MdOutlineDeliveryDining, nextStatus: 'delivered', nextLabel: 'Mark Delivered' },
  { key: 'picked_up', label: 'Pickups', icon: HiOutlineTruck, nextStatus: 'in_process', nextLabel: 'Start Processing' },
];

export default function OrderStatusPage() {
  const [activeTab, setActiveTab] = useState('in_process');
  const [bookings, setBookings] = useState([]);
  const [counts, setCounts] = useState({}); // status -> number of orders, for the tab badges
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState(null); // Which booking is being assigned
  const [historyFor, setHistoryFor] = useState(null); // booking whose history is open

  useEffect(() => { fetchBookings(); fetchCounts(); fetchDrivers(); }, [activeTab]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bookings', { params: { status: activeTab, limit: 50 } });
      setBookings(res.data?.bookings || []);
    } catch (err) {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  // Every tab shows how many orders are waiting there; limit 1 because only the total is needed
  const fetchCounts = async () => {
    const totals = await Promise.all(tabs.map(async (t) => {
      try {
        const res = await api.get('/bookings', { params: { status: t.key, limit: 1 } });
        return [t.key, res.data?.total ?? 0];
      } catch (err) { return [t.key, undefined]; }
    }));
    setCounts(Object.fromEntries(totals));
  };

  const reload = () => { fetchBookings(); fetchCounts(); };

  const fetchDrivers = async () => {
    try {
      const res = await api.get('/admin/delivery-boys');
      setDrivers((res.data || []).filter(d => d.isActive));
    } catch (err) { /* ignore */ }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await api.patch(`/bookings/${id}/status`, { status: newStatus });
      toast.success(`Status updated to "${newStatus.replace(/_/g, ' ')}"`);
      reload();
    } catch (err) {
      toast.error(err.message || 'Failed to update');
    }
  };

  const assignDriver = async (bookingId, driverId) => {
    try {
      await api.post(`/admin/bookings/${bookingId}/assign-driver`, { driverId });
      toast.success('Driver assigned');
      setAssigningId(null);
      fetchBookings();
    } catch (err) {
      toast.error(err.message || 'Failed to assign');
    }
  };

  const markDelivered = async (id) => {
    try {
      await api.patch(`/bookings/${id}/status`, { status: 'delivered' });
      toast.success('Order marked as delivered');
      reload();
    } catch (err) {
      toast.error(err.message || 'Failed');
    }
  };

  const currentTab = tabs.find(t => t.key === activeTab);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Order Management</h2>

      {/* Status Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? 'bg-secondary text-white shadow-md'
                : 'bg-white text-gray-600 shadow-sm hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            <span>{tab.label}</span>
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
              activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {counts[tab.key] ?? '·'}
            </span>
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <p className="text-gray-400 text-center py-12">Loading...</p>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <currentTab.icon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">No orders in "{currentTab.label}" status</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <div key={booking.id} className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {/* Order Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className="font-mono font-bold text-sm text-secondary">{booking.orderNumber}</span>
                    {booking.orderType === 'offline' ? (
                      <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full text-xs font-medium">Offline</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">Online</span>
                    )}
                    <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-500">
                      {booking.items?.length || 0} items
                    </span>
                    {booking.driverId && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs">
                        Driver: {drivers.find(d => d.id === booking.driverId)?.name || 'Assigned'}
                      </span>
                    )}
                    {booking.failedAttempts > 0 && (
                      <button
                        onClick={() => setHistoryFor(booking)}
                        className="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-xs hover:bg-red-100"
                        title="Reported in the driver app. Open the history."
                      >
                        {booking.failedAttempts} failed attempt{booking.failedAttempts === 1 ? '' : 's'}
                        {booking.lastFailure?.reason ? ` · ${booking.lastFailure.reason}` : ''}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    {booking.customerName && <span className="font-medium text-gray-600">{booking.customerName}</span>}
                    <span>Pickup: {booking.pickupDate || '—'}</span>
                    <span>Time: {booking.timeSlot?.label || '—'}</span>
                    <span className="font-medium text-gray-700">₹{booking.total}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  {/* Order history: driver-app actions and staff changes */}
                  <button
                    onClick={() => setHistoryFor(booking)}
                    className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100"
                    title="Order history"
                  >
                    <HiOutlineClipboardList className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">History</span>
                  </button>

                  {/* Assign Driver */}
                  {assigningId === booking.id ? (
                    <div className="flex items-center gap-1">
                      <select
                        onChange={(e) => { if (e.target.value) assignDriver(booking.id, e.target.value); }}
                        className="text-xs border rounded-lg px-2 py-2"
                        defaultValue=""
                      >
                        <option value="" disabled>Select Driver</option>
                        {drivers.map(d => (
                          <option key={d.id} value={d.id}>{d.name} ({d.activeOrders} active)</option>
                        ))}
                      </select>
                      <button onClick={() => setAssigningId(null)} className="text-xs text-gray-400 px-1">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAssigningId(booking.id)}
                      className="flex items-center gap-1 px-2 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100"
                      title="Assign Driver"
                    >
                      <HiOutlineUserAdd className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{booking.driverId ? 'Reassign' : 'Assign'}</span>
                    </button>
                  )}

                  {/* Move to next status */}
                  <button
                    onClick={() => updateStatus(booking.id, currentTab.nextStatus)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-white rounded-lg text-xs font-medium transition-colors ${currentTab.nextStatus === 'delivered' ? 'bg-green-500 hover:bg-green-600' : 'bg-primary hover:bg-primary-dark'}`}
                  >
                    <span>{currentTab.nextLabel}</span>
                    <HiArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Mark delivered */}
                  {activeTab === 'ready' && (
                    <button
                      onClick={() => markDelivered(booking.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600"
                    >
                      Delivered
                    </button>
                  )}

                  {/* Status dropdown */}
                  <select
                    value={booking.status}
                    onChange={(e) => updateStatus(booking.id, e.target.value)}
                    className="text-xs border rounded-lg px-2 py-2 text-gray-600"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="pickup_scheduled">Pickup Scheduled</option>
                    <option value="picked_up">Picked Up</option>
                    <option value="in_process">In Process</option>
                    <option value="ready">Ready</option>
                    <option value="out_for_delivery">Out for Delivery</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Items preview */}
              {booking.items && booking.items.length > 0 && (
                <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
                  {booking.items.slice(0, 5).map((item, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-50 rounded text-xs text-gray-600">
                      {item.name} × {item.quantity}
                    </span>
                  ))}
                  {booking.items.length > 5 && (
                    <span className="px-2 py-1 text-xs text-gray-400">+{booking.items.length - 5} more</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {historyFor && <HistoryModal booking={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

const STATUS_LABELS = {
  pending: 'Pending', confirmed: 'Confirmed', pickup_scheduled: 'Pickup scheduled', picked_up: 'Picked up',
  in_process: 'In process', ready: 'Ready', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled',
};
// What a driver's status change means on the road
const DRIVER_ACTIONS = { picked_up: 'Picked up', in_process: 'Handed to store', out_for_delivery: 'Out for delivery', delivered: 'Delivered' };
const statusLabel = (status) => STATUS_LABELS[status] || status;
const formatWhen = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** How one booking_events row reads in the timeline */
const describeEvent = (e) => {
  switch (e.type) {
    case 'driver_assigned':
      return {
        icon: HiOutlineUserAdd,
        tone: 'bg-blue-50 text-blue-600',
        title: e.note || 'Driver assigned',
        subtitle: e.fromStatus !== e.toStatus ? `${statusLabel(e.fromStatus)} → ${statusLabel(e.toStatus)}` : null,
        hideNote: true,
      };
    case 'pickup_failed':
      return { icon: HiOutlineExclamationCircle, tone: 'bg-red-50 text-red-600', title: 'Pickup attempt failed', subtitle: e.reason };
    case 'delivery_failed':
      return { icon: HiOutlineExclamationCircle, tone: 'bg-red-50 text-red-600', title: 'Delivery attempt failed · back to Ready', subtitle: e.reason };
    case 'cash_collected':
      return { icon: HiOutlineCash, tone: 'bg-green-50 text-green-600', title: `Cash collected ₹${e.amount}` };
    default: {
      const byDriver = e.actor?.role === 'driver';
      return {
        icon: HiOutlineSwitchHorizontal,
        tone: 'bg-gray-100 text-gray-600',
        title: byDriver ? (DRIVER_ACTIONS[e.toStatus] || statusLabel(e.toStatus)) : `Marked ${statusLabel(e.toStatus)}`,
        subtitle: e.fromStatus && e.fromStatus !== e.toStatus ? `from ${statusLabel(e.fromStatus)}` : null,
      };
    }
  }
};

/** Timeline of an order: what drivers did in the app (reasons, piece count, cash, photos) and staff changes */
function HistoryModal({ booking, onClose }) {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/admin/bookings/${booking.id}/events`);
        setEvents(res.data?.events || []);
      } catch (err) {
        setError(err.message || 'Failed to load the history');
      }
    })();
  }, [booking.id]);

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="font-semibold text-gray-800">Order {booking.orderNumber} · history</h3>
            <p className="text-xs text-gray-400">Driver-app actions and staff changes, newest first</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Close"><HiX className="w-5 h-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto">
          {error ? (
            <p className="text-center text-red-500 text-sm py-6">{error}</p>
          ) : events === null ? (
            <p className="text-center text-gray-400 text-sm py-6">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">Nothing recorded yet. Driver actions and status changes will appear here.</p>
          ) : (
            <ol className="relative border-l border-gray-200 ml-3 space-y-5">
              {events.map((e) => {
                const d = describeEvent(e);
                const Icon = d.icon;
                return (
                  <li key={e.id} className="ml-6">
                    <span className={`absolute -left-3.5 flex items-center justify-center w-7 h-7 rounded-full ring-4 ring-white ${d.tone}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <p className="text-sm font-medium text-gray-800">{d.title}</p>
                    {d.subtitle && <p className="text-xs text-gray-500">{d.subtitle}</p>}
                    {e.itemCount !== null && e.itemCount !== undefined && (
                      <p className="text-xs text-gray-600 mt-0.5">{e.itemCount} piece{e.itemCount === 1 ? '' : 's'} counted</p>
                    )}
                    {!d.hideNote && e.note && <p className="text-xs text-gray-600 italic mt-0.5">"{e.note}"</p>}
                    {e.photoUrl && (
                      <a href={e.photoUrl} target="_blank" rel="noreferrer" className="inline-block mt-1.5" title="Open photo">
                        <img src={e.photoUrl} alt="Proof" className="w-16 h-16 object-cover rounded-lg border" />
                      </a>
                    )}
                    <p className="text-[11px] text-gray-400 mt-1">
                      {e.actor ? `${e.actor.name || 'Someone'} (${e.actor.role})` : 'System'} · {formatWhen(e.createdAt)}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
