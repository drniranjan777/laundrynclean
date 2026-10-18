import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  HiOutlineClock, HiOutlineBadgeCheck, HiOutlineTruck, HiOutlineCheckCircle, HiOutlineOfficeBuilding, HiOutlineCube,
  HiOutlineInbox, HiOutlineCalendar, HiOutlineUserAdd, HiOutlineClipboardList, HiOutlineSearch, HiOutlineRefresh,
  HiArrowRight, HiOutlinePencilAlt, HiOutlineReply, HiOutlineX,
} from 'react-icons/hi';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import { useLocations } from '../context/LocationContext';
import {
  ConfirmDeliveredDialog, ConfirmCollectedDialog, ReasonDialog, CorrectionDialog, OrderHistoryModal,
} from '../components/OrderWorkflow';
import { statusLabel, statusBadge, paymentBadge, formatDateTime, formatDate, CORRECTIONS } from '../utils/orderStatus';

// Processing and handover: the main tabs
const WORKFLOW_TABS = [
  { key: 'in_process', label: 'In Process', hint: 'Being cleaned', icon: HiOutlineClock, tone: 'text-blue-600 bg-blue-50' },
  { key: 'ready', label: 'Ready', hint: 'Awaiting handover', icon: HiOutlineBadgeCheck, tone: 'text-emerald-600 bg-emerald-50' },
  { key: 'out_for_delivery', label: 'Out for Delivery', hint: 'With driver', icon: HiOutlineTruck, tone: 'text-orange-600 bg-orange-50' },
  { key: 'delivered', label: 'Delivered', hint: 'Handover complete', icon: HiOutlineCheckCircle, tone: 'text-green-600 bg-green-50' },
  { key: 'ready_for_pickup', label: 'Ready for Pickup', hint: 'At shop', icon: HiOutlineOfficeBuilding, tone: 'text-purple-600 bg-purple-50' },
  { key: 'collected', label: 'Collected', hint: 'Customer collected', icon: HiOutlineCube, tone: 'text-slate-600 bg-slate-100' },
];

// Coming in from customers (kept apart from delivery and collection)
const INCOMING_TABS = [
  { key: 'pending,confirmed', label: 'New / Received', icon: HiOutlineInbox },
  { key: 'pickup_scheduled', label: 'Pickup scheduled', icon: HiOutlineCalendar },
  { key: 'picked_up', label: 'Picked up', icon: HiOutlineTruck },
];

const ALL_TABS = [...WORKFLOW_TABS, ...INCOMING_TABS];
const PAGE_SIZE = 30;
const EMPTY_FILTERS = { search: '', dateFrom: '', dateTo: '', driverId: '', orderType: '' };

export default function OrderStatusPage() {
  const { user } = useAuth();
  const { locations, isManager } = useLocations();
  const isAdmin = user?.role === 'admin';
  const storeName = (id) => locations.find(l => l.id === id)?.name;

  const [activeTab, setActiveTab] = useState('in_process');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState(''); // typed text; applied to filters after a short pause
  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [counts, setCounts] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState(null);
  const [dialog, setDialog] = useState(null); // { kind, booking, to? }

  const params = useCallback(() => {
    const p = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v; });
    return p;
  }, [filters]);

  const fetchBookings = useCallback(async (nextPage = 1) => {
    setLoading(nextPage === 1);
    try {
      const res = await api.get('/bookings', { params: { ...params(), status: activeTab, limit: PAGE_SIZE, page: nextPage } });
      const rows = res.data?.bookings || [];
      setBookings(prev => (nextPage === 1 ? rows : [...prev, ...rows]));
      setTotal(res.data?.total ?? rows.length);
      setPage(nextPage);
    } catch (err) {
      if (nextPage === 1) setBookings([]);
      toast.error(err.message || 'Could not load orders');
    } finally {
      setLoading(false);
    }
  }, [activeTab, params]);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await api.get('/admin/bookings/status-counts', { params: params() });
      setCounts(res.data?.counts || {});
    } catch (err) {
      setCounts(null);
    }
  }, [params]);

  useEffect(() => { fetchBookings(1); }, [fetchBookings]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/admin/delivery-boys');
        setDrivers((res.data || []).filter(d => d.isActive));
      } catch (err) { /* the partner filter just stays empty */ }
    })();
  }, []);
  useEffect(() => {
    const id = setTimeout(() => setFilters(f => (f.search === search.trim() ? f : { ...f, search: search.trim() })), 350);
    return () => clearTimeout(id);
  }, [search]);

  const reload = () => { fetchBookings(1); fetchCounts(); };
  const closeDialog = () => setDialog(null);
  const afterDialog = () => { setDialog(null); reload(); };

  const countFor = (key) => {
    if (!counts) return null;
    return key.split(',').reduce((n, s) => n + (counts[s] || 0), 0);
  };

  const move = async (booking, status, success) => {
    try {
      await api.patch(`/bookings/${booking.id}/status`, { status });
      toast.success(success || `Moved to ${statusLabel(status)}`);
      reload();
    } catch (err) {
      toast.error(err.message || 'Could not update the order');
    }
  };

  const assignDriver = async (bookingId, driverId) => {
    try {
      await api.post(`/admin/bookings/${bookingId}/assign-driver`, { driverId });
      toast.success('Delivery partner assigned');
      setAssigningId(null);
      reload();
    } catch (err) {
      toast.error(err.message || 'Failed to assign');
    }
  };

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }));
  const hasFilters = Object.values(filters).some(Boolean) || search;
  const current = ALL_TABS.find(t => t.key === activeTab);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Order Management</h2>
          <p className="text-sm text-gray-500">From the shop floor to the customer's hands: every handover is recorded.</p>
        </div>
        <button onClick={reload} className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white rounded-lg shadow-sm hover:bg-gray-50">
          <HiOutlineRefresh className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Processing and handover */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        {WORKFLOW_TABS.map(tab => {
          const active = activeTab === tab.key;
          const n = countFor(tab.key);
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`text-left rounded-xl border p-3.5 transition-all ${active ? 'bg-white border-primary ring-2 ring-primary/30 shadow-md' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}
            >
              <div className="flex items-start justify-between">
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${tab.tone}`}><tab.icon className="w-5 h-5" /></span>
                <span className={`text-xl font-bold ${active ? 'text-secondary' : 'text-gray-700'}`}>{n ?? '·'}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-gray-800">{tab.label}</p>
              <p className="text-xs text-gray-500">{tab.hint}</p>
            </button>
          );
        })}
      </div>

      {/* Incoming from customers: pickup scheduling stays separate from delivery and collection */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mr-1">Incoming</span>
        {INCOMING_TABS.map(tab => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${active ? 'bg-secondary text-white border-secondary' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <span className={`px-1.5 rounded-full ${active ? 'bg-white/20' : 'bg-gray-100'}`}>{countFor(tab.key) ?? '·'}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-3 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 items-end">
        <label className="lg:col-span-2 relative">
          <span className="sr-only">Search</span>
          <HiOutlineSearch className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order #, customer name or mobile"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </label>
        <label className="text-xs text-gray-500">
          Order date from
          <input type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(e) => setFilter('dateFrom', e.target.value)} className="mt-0.5 w-full px-2 py-1.5 border rounded-lg text-sm text-gray-700" />
        </label>
        <label className="text-xs text-gray-500">
          to
          <input type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(e) => setFilter('dateTo', e.target.value)} className="mt-0.5 w-full px-2 py-1.5 border rounded-lg text-sm text-gray-700" />
        </label>
        <label className="text-xs text-gray-500">
          Delivery partner
          <select value={filters.driverId} onChange={(e) => setFilter('driverId', e.target.value)} className="mt-0.5 w-full px-2 py-1.5 border rounded-lg text-sm text-gray-700">
            <option value="">All partners</option>
            <option value="none">No partner</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <div className="flex gap-2 items-end">
          <label className="text-xs text-gray-500 flex-1">
            Type
            <select value={filters.orderType} onChange={(e) => setFilter('orderType', e.target.value)} className="mt-0.5 w-full px-2 py-1.5 border rounded-lg text-sm text-gray-700">
              <option value="">All</option>
              <option value="online">Online</option>
              <option value="offline">Store</option>
            </select>
          </label>
          {hasFilters && (
            <button onClick={() => { setFilters(EMPTY_FILTERS); setSearch(''); }} className="p-2 text-gray-400 hover:text-gray-600" title="Clear filters" aria-label="Clear filters">
              <HiOutlineX className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Orders */}
      {loading ? (
        <p className="text-gray-400 text-center py-12">Loading…</p>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center">
          <current.icon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No orders in {current.label}</p>
          {hasFilters && <p className="text-sm text-gray-400 mt-1">Try clearing the filters.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map(booking => (
            <OrderCard
              key={booking.id}
              booking={booking}
              tab={activeTab}
              isAdmin={isAdmin}
              store={!isManager ? storeName(booking.locationId) : null}
              drivers={drivers}
              assigning={assigningId === booking.id}
              onAssignStart={() => setAssigningId(booking.id)}
              onAssignCancel={() => setAssigningId(null)}
              onAssign={(driverId) => assignDriver(booking.id, driverId)}
              onMove={(status, msg) => move(booking, status, msg)}
              onDialog={(kind, to) => setDialog({ kind, booking, to })}
            />
          ))}
          {bookings.length < total && (
            <button onClick={() => fetchBookings(page + 1)} className="w-full py-3 text-sm font-medium text-secondary bg-white rounded-xl shadow-sm hover:bg-gray-50">
              Show more ({total - bookings.length} more)
            </button>
          )}
        </div>
      )}

      {dialog?.kind === 'deliver' && <ConfirmDeliveredDialog booking={dialog.booking} drivers={drivers} onClose={closeDialog} onDone={afterDialog} />}
      {dialog?.kind === 'collect' && <ConfirmCollectedDialog booking={dialog.booking} onClose={closeDialog} onDone={afterDialog} />}
      {dialog?.kind === 'reason' && <ReasonDialog booking={dialog.booking} to={dialog.to} onClose={closeDialog} onDone={afterDialog} />}
      {dialog?.kind === 'correct' && <CorrectionDialog booking={dialog.booking} onClose={closeDialog} onDone={afterDialog} />}
      {dialog?.kind === 'history' && <OrderHistoryModal booking={dialog.booking} onClose={closeDialog} />}
    </div>
  );
}

const btn = {
  primary: 'bg-primary hover:bg-primary-dark text-white',
  success: 'bg-green-600 hover:bg-green-700 text-white',
  purple: 'bg-purple-600 hover:bg-purple-700 text-white',
  ghost: 'bg-gray-50 hover:bg-gray-100 text-gray-600',
  blue: 'bg-blue-50 hover:bg-blue-100 text-blue-600',
  danger: 'text-red-600 hover:bg-red-50',
  amber: 'bg-amber-50 hover:bg-amber-100 text-amber-700',
};
const Action = ({ tone = 'primary', onClick, children, title }) => (
  <button onClick={onClick} title={title} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${btn[tone]}`}>{children}</button>
);

function OrderCard({ booking, tab, isAdmin, store, drivers, assigning, onAssignStart, onAssignCancel, onAssign, onMove, onDialog }) {
  const s = booking.status;
  const pay = paymentBadge(booking);
  const pieces = (booking.items || []).reduce((n, i) => n + (Number(i.quantity) || 0), 0);
  const isStore = booking.orderType === 'offline';
  const canCancel = !['delivered', 'collected', 'cancelled'].includes(s);
  const canAssign = !['delivered', 'collected', 'cancelled', 'ready_for_pickup'].includes(s);
  const storeDrivers = drivers.filter(d => !booking.locationId || !d.locationId || d.locationId === booking.locationId);

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono font-bold text-sm text-secondary">{booking.orderNumber}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isStore ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>{isStore ? 'Store' : 'Online'}</span>
            {tab.includes(',') && <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(s)}`}>{statusLabel(s)}</span>}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pay.className}`}>{pay.text}</span>
            <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-500">{pieces} piece{pieces === 1 ? '' : 's'}</span>
            {booking.failedAttempts > 0 && (
              <button onClick={() => onDialog('history')} className="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-xs hover:bg-red-100" title="Open the history">
                {booking.failedAttempts} failed attempt{booking.failedAttempts === 1 ? '' : 's'}{booking.lastFailure?.reason ? ` · ${booking.lastFailure.reason}` : ''}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{booking.customerName || 'Customer'}{booking.customerPhone ? ` · ${booking.customerPhone}` : ''}</span>
            <span className="font-medium text-gray-700">₹{booking.total}</span>
            {store && <span>{store}</span>}
            <span>Placed {formatDate(booking.createdAt || booking.created_at)}</span>
            {booking.estimatedDeliveryDate && !['delivered', 'collected'].includes(s) && <span>Due {formatDate(booking.estimatedDeliveryDate)}</span>}
            {booking.driver
              ? <span className="text-blue-600">Partner: {booking.driver.name}</span>
              : !isStore && !['delivered', 'collected', 'ready_for_pickup'].includes(s) && <span className="text-gray-400">No delivery partner</span>}
          </div>
          {s === 'delivered' && (
            <p className="mt-1.5 text-xs text-green-700">
              Delivered {formatDateTime(booking.deliveredAt)}{booking.receivedBy ? ` · received by ${booking.receivedBy}` : ''}{booking.driver ? ` · by ${booking.driver.name}` : ''}
            </p>
          )}
          {s === 'collected' && (
            <p className="mt-1.5 text-xs text-slate-700">Collected {formatDateTime(booking.collectedAt)}{booking.collectedBy ? ` · by ${booking.collectedBy}` : ''}</p>
          )}
          {s === 'ready_for_pickup' && <p className="mt-1.5 text-xs text-purple-700">Waiting at {store || 'the shop'} for the customer</p>}
        </div>

        <div className="flex items-center gap-2 flex-wrap lg:justify-end">
          <Action tone="ghost" onClick={() => onDialog('history')} title="Order history"><HiOutlineClipboardList className="w-4 h-4" />History</Action>

          {canAssign && (assigning ? (
            <span className="flex items-center gap-1">
              <select onChange={(e) => { if (e.target.value) onAssign(e.target.value); }} className="text-xs border rounded-lg px-2 py-2" defaultValue="">
                <option value="" disabled>Select partner</option>
                {storeDrivers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.activeOrders} active)</option>)}
              </select>
              <button onClick={onAssignCancel} className="text-xs text-gray-400 px-1" aria-label="Cancel">✕</button>
            </span>
          ) : (
            <Action tone="blue" onClick={onAssignStart}><HiOutlineUserAdd className="w-4 h-4" />{booking.driverId ? 'Reassign' : 'Assign'}</Action>
          ))}

          {(s === 'confirmed' || s === 'picked_up') && (s === 'picked_up' || isStore) && (
            <Action onClick={() => onMove('in_process', 'Processing started')}>Start processing <HiArrowRight className="w-3.5 h-3.5" /></Action>
          )}
          {s === 'in_process' && <Action onClick={() => onMove('ready', 'Marked ready')}>Mark ready <HiArrowRight className="w-3.5 h-3.5" /></Action>}
          {s === 'ready' && (
            <>
              <Action onClick={() => onMove('out_for_delivery', 'Out for delivery')}><HiOutlineTruck className="w-4 h-4" />Out for delivery</Action>
              <Action tone="purple" onClick={() => onMove('ready_for_pickup', 'Ready for pickup at the shop')}><HiOutlineOfficeBuilding className="w-4 h-4" />Ready for pickup</Action>
            </>
          )}
          {s === 'out_for_delivery' && (
            <>
              <Action tone="success" onClick={() => onDialog('deliver')}><HiOutlineCheckCircle className="w-4 h-4" />Confirm delivered</Action>
              <Action tone="amber" onClick={() => onDialog('reason', 'ready')}><HiOutlineReply className="w-4 h-4" />Not delivered</Action>
            </>
          )}
          {s === 'ready_for_pickup' && (
            <>
              <Action tone="success" onClick={() => onDialog('collect')}><HiOutlineCheckCircle className="w-4 h-4" />Confirm collected</Action>
              <Action tone="amber" onClick={() => onDialog('reason', 'ready')}><HiOutlineReply className="w-4 h-4" />Deliver instead</Action>
            </>
          )}
          {isAdmin && ['delivered', 'collected', 'ready'].includes(s) && CORRECTIONS[s] && (
            <Action tone="ghost" onClick={() => onDialog('correct')} title="Undo a mistaken status"><HiOutlinePencilAlt className="w-4 h-4" />Correct</Action>
          )}
          {canCancel && <Action tone="danger" onClick={() => onDialog('reason', 'cancelled')}>Cancel</Action>}
        </div>
      </div>

      {booking.items?.length > 0 && (
        <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
          {booking.items.slice(0, 6).map((item, i) => (
            <span key={i} className="px-2 py-1 bg-gray-50 rounded text-xs text-gray-600">{item.name} × {item.quantity}</span>
          ))}
          {booking.items.length > 6 && <span className="px-2 py-1 text-xs text-gray-400">+{booking.items.length - 6} more</span>}
        </div>
      )}
    </div>
  );
}
