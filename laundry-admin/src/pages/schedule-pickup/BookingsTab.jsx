import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlineSearch, HiOutlineX, HiOutlineCalculator, HiOutlineClipboardList, HiOutlineRefresh } from 'react-icons/hi';
import api from '../../api/axios';
import { useLocations } from '../../context/LocationContext';
import { OrderHistoryModal } from '../../components/OrderWorkflow';
import BillPickupDialog from '../../components/BillPickupDialog';
import { statusLabel, statusBadge, paymentBadge, rupees, STATUS_ORDER } from '../../utils/orderStatus';
import { Empty, addDays, prettyDay } from './ui';

const PAGE_SIZE = 25;
const todayIst = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const blankFilters = () => ({ search: '', pickupFrom: todayIst(), pickupTo: addDays(todayIst(), 14), locationId: '', timeSlotId: '', paymentStatus: '', driverId: '', status: '' });

/** Bulk pickups by scheduled date, with the filters the store needs to plan the day */
export default function BookingsTab({ onChanged }) {
  const { locations, isManager } = useLocations();
  const [filters, setFilters] = useState(blankFilters);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    api.get('/admin/pickup/slots').then(r => setSlots(r.data || [])).catch(() => {});
    api.get('/admin/delivery-boys').then(r => setDrivers((r.data || []).filter(d => d.isActive))).catch(() => {});
  }, []);
  useEffect(() => {
    const id = setTimeout(() => setFilters(f => (f.search === search.trim() ? f : { ...f, search: search.trim() })), 350);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async (nextPage = 1) => {
    setLoading(nextPage === 1);
    try {
      const params = { bookingType: 'bulk_pickup', sort: 'pickup', limit: PAGE_SIZE, page: nextPage };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await api.get('/bookings', { params });
      const list = res.data?.bookings || [];
      setRows(prev => (nextPage === 1 ? list : [...prev, ...list]));
      setTotal(res.data?.total ?? list.length);
      setPage(nextPage);
    } catch (err) {
      toast.error(err.message || 'Could not load bookings');
    } finally {
      setLoading(false);
    }
  }, [filters]);
  useEffect(() => { load(1); }, [load]);

  const assign = async (booking, driverId) => {
    try {
      await api.post(`/admin/bookings/${booking.id}/assign-driver`, { driverId });
      toast.success('Pickup partner assigned');
      load(1); onChanged?.();
    } catch (err) { toast.error(err.message || 'Could not assign'); }
  };

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const storeName = (id) => locations.find(l => l.id === id)?.name || '—';
  const afterBill = () => { setDialog(null); load(1); onChanged?.(); };

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm p-3 mb-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 items-end">
        <label className="col-span-2 relative">
          <span className="sr-only">Search</span>
          <HiOutlineSearch className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order #, customer or mobile" className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
        </label>
        <label className="text-xs text-gray-500">Pickup from
          <input type="date" value={filters.pickupFrom} max={filters.pickupTo || undefined} onChange={(e) => set('pickupFrom', e.target.value)} className="mt-0.5 w-full px-2 py-1.5 border rounded-lg text-sm text-gray-700" />
        </label>
        <label className="text-xs text-gray-500">to
          <input type="date" value={filters.pickupTo} min={filters.pickupFrom || undefined} onChange={(e) => set('pickupTo', e.target.value)} className="mt-0.5 w-full px-2 py-1.5 border rounded-lg text-sm text-gray-700" />
        </label>
        {!isManager && (
          <label className="text-xs text-gray-500">Store
            <select value={filters.locationId} onChange={(e) => set('locationId', e.target.value)} className="mt-0.5 w-full px-2 py-1.5 border rounded-lg text-sm text-gray-700">
              <option value="">All stores</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
        )}
        <label className="text-xs text-gray-500">Time slot
          <select value={filters.timeSlotId} onChange={(e) => set('timeSlotId', e.target.value)} className="mt-0.5 w-full px-2 py-1.5 border rounded-lg text-sm text-gray-700">
            <option value="">All slots</option>
            {slots.map(s => <option key={s.id} value={s.id}>{s.label}{s.isActive ? '' : ' (off)'}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500">Status
          <select value={filters.status} onChange={(e) => set('status', e.target.value)} className="mt-0.5 w-full px-2 py-1.5 border rounded-lg text-sm text-gray-700">
            <option value="">Any status</option>
            {STATUS_ORDER.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500">Payment
          <select value={filters.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)} className="mt-0.5 w-full px-2 py-1.5 border rounded-lg text-sm text-gray-700">
            <option value="">Any</option>
            <option value="pending">Not paid</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </label>
        <label className="text-xs text-gray-500">Partner
          <select value={filters.driverId} onChange={(e) => set('driverId', e.target.value)} className="mt-0.5 w-full px-2 py-1.5 border rounded-lg text-sm text-gray-700">
            <option value="">All partners</option>
            <option value="none">Not assigned</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <div className="flex gap-1 items-end">
          <button onClick={() => load(1)} className="p-2 text-gray-500 hover:text-gray-700" title="Refresh" aria-label="Refresh"><HiOutlineRefresh className="w-5 h-5" /></button>
          <button onClick={() => { setFilters(blankFilters()); setSearch(''); }} className="p-2 text-gray-400 hover:text-gray-600" title="Reset filters" aria-label="Reset filters"><HiOutlineX className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b text-xs text-gray-500">{loading ? 'Loading…' : `${total} bulk pickup${total === 1 ? '' : 's'}`}</div>
        {!loading && rows.length === 0 ? (
          <Empty>No bulk pickups match these filters.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3 text-left">Pickup</th>
                  <th className="px-4 py-3 text-left">Order</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  {!isManager && <th className="px-4 py-3 text-left hidden lg:table-cell">Store</th>}
                  <th className="px-4 py-3 text-left">Partner</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map(b => {
                  const pay = paymentBadge(b);
                  const billed = Number(b.total) > 0;
                  const canBill = b.paymentStatus !== 'paid' && ['picked_up', 'in_process', 'ready'].includes(b.status);
                  const canAssign = ['pending', 'confirmed', 'pickup_scheduled'].includes(b.status);
                  const storeDrivers = drivers.filter(d => !b.locationId || !d.locationId || d.locationId === b.locationId);
                  return (
                    <tr key={b.id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-medium text-gray-800">{prettyDay(b.pickupDate)}</p>
                        <p className="text-xs text-gray-500">{b.timeSlot?.label || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono font-semibold text-secondary">{b.orderNumber}</p>
                        <p className="text-xs text-gray-500">{b.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-800">{b.customerName || 'Customer'}</p>
                        <p className="text-xs text-gray-500">{b.customerPhone || ''}</p>
                        {b.notes && <p className="text-xs text-gray-500 italic mt-0.5 max-w-[16rem] truncate" title={b.notes}>“{b.notes}”</p>}
                      </td>
                      {!isManager && <td className="px-4 py-3 hidden lg:table-cell text-gray-600">{storeName(b.locationId)}</td>}
                      <td className="px-4 py-3">
                        {canAssign ? (
                          <select value={b.driverId || ''} onChange={(e) => e.target.value && assign(b, e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 max-w-[10rem]" aria-label="Assign pickup partner">
                            <option value="">{b.driver ? b.driver.name : 'Assign partner…'}</option>
                            {storeDrivers.filter(d => d.id !== b.driverId).map(d => <option key={d.id} value={d.id}>{d.name} ({d.activeOrders} active)</option>)}
                          </select>
                        ) : (
                          <span className="text-gray-600">{b.driver?.name || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(b.status)}`}>{statusLabel(b.status)}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-medium text-gray-800">{billed ? rupees(b.total) : 'Not billed'}</p>
                        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[11px] ${pay.className}`}>{pay.text}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {canBill && (
                            <button onClick={() => setDialog({ kind: 'bill', booking: b })} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100">
                              <HiOutlineCalculator className="w-4 h-4" />{billed ? 'Edit bill' : 'Bill'}
                            </button>
                          )}
                          <button onClick={() => setDialog({ kind: 'history', booking: b })} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-gray-600 hover:bg-gray-100">
                            <HiOutlineClipboardList className="w-4 h-4" />History
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows.length < total && !loading && (
          <button onClick={() => load(page + 1)} className="w-full py-3 text-sm font-medium text-secondary border-t hover:bg-gray-50">Show more ({total - rows.length} more)</button>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Status changes, delivery and collection are handled in <Link to="/order-status" className="text-secondary font-medium hover:underline">Order Management</Link> (filter Booking: Bulk pickups).
      </p>

      {dialog?.kind === 'bill' && <BillPickupDialog booking={dialog.booking} onClose={() => setDialog(null)} onDone={afterBill} />}
      {dialog?.kind === 'history' && <OrderHistoryModal booking={dialog.booking} onClose={() => setDialog(null)} />}
    </div>
  );
}
