import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useLocations } from '../context/LocationContext';
import { ConfirmDeliveredDialog, ConfirmCollectedDialog, ReasonDialog, OrderHistoryModal } from '../components/OrderWorkflow';
import { STATUS_ORDER, TRANSITIONS, statusLabel, statusBadge, needsReason, formatDateTime, formatDate } from '../utils/orderStatus';

const PAYMENT_LABELS = { paid: 'Paid', pending: 'Payment pending', failed: 'Payment failed', refunded: 'Refunded' };
const METHOD_LABELS = { cod: 'Cash', upi: 'UPI', card: 'Card', wallet: 'Wallet' };

export default function BookingsPage() {
  const { locations, isManager } = useLocations();
  const storeName = (id) => locations.find(l => l.id === id)?.name;
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filters live in the address (?status=&type=&payment=&method=&date=&page=), so dashboard cards can link
  // straight to a filtered list and the list survives a reload
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('status') || '';
  const typeFilter = searchParams.get('type') || ''; // '', 'online', 'offline'
  const payment = searchParams.get('payment') || '';
  const method = searchParams.get('method') || '';
  const date = searchParams.get('date') || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };
  const setPage = (n) => setParam('page', n > 1 ? String(n) : '');

  // One list for online and store orders, filtered and paged by the API
  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bookings', {
        params: {
          page,
          limit: 15,
          status: filter || undefined,
          orderType: typeFilter || undefined,
          paymentStatus: payment || undefined,
          paymentMethod: method || undefined,
          dateFrom: date || undefined,
          dateTo: date || undefined,
        },
      });
      setBookings(res.data?.bookings || []);
      setTotal(res.data?.total ?? 0);
      setTotalPages(Math.max(1, res.data?.totalPages || 1));
    } catch (err) {
      setBookings([]);
      setTotal(0);
      toast.error(err.message || 'Could not load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, [page, filter, typeFilter, payment, method, date]);

  // Filters that come from a dashboard link and have no control of their own: shown as removable chips
  const chips = [
    payment && { key: 'payment', label: PAYMENT_LABELS[payment] || payment },
    method && { key: 'method', label: `Paid by ${METHOD_LABELS[method] || method}` },
    date && { key: 'date', label: `Placed ${formatDate(`${date}T00:00:00`)}` },
  ].filter(Boolean);

  const [drivers, setDrivers] = useState([]);
  useEffect(() => {
    api.get('/admin/delivery-boys').then(res => setDrivers((res.data || []).filter(d => d.isActive))).catch(() => {});
  }, []);
  const [dialog, setDialog] = useState(null); // { kind, booking, to? }
  const afterDialog = () => { setDialog(null); setSelectedOrder(null); fetchBookings(); };

  // Delivered / collected are confirmed in a dialog; cancelling and sending back ask for a reason
  const updateStatus = async (booking, status) => {
    if (status === booking.status) return;
    if (status === 'delivered') return setDialog({ kind: 'deliver', booking });
    if (status === 'collected') return setDialog({ kind: 'collect', booking });
    if (needsReason(booking.status, status)) return setDialog({ kind: 'reason', booking, to: status });
    try {
      await api.patch(`/bookings/${booking.id}/status`, { status });
      toast.success(`Moved to ${statusLabel(status)}`);
      fetchBookings();
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [moveTo, setMoveTo] = useState('');
  const viewOrder = (order) => { setSelectedOrder(order); setMoveTo(''); };

  // Admins can hand an online order to another store (store bills stay where they were billed)
  const moveOrder = async () => {
    try {
      const res = await api.patch(`/admin/bookings/${selectedOrder.id}/location`, { locationId: moveTo });
      toast.success(res.message || 'Order moved');
      setSelectedOrder({ ...selectedOrder, locationId: res.data.locationId, driverId: res.data.driverId });
      setMoveTo('');
      fetchBookings();
    } catch (err) {
      toast.error(err.message || 'Failed to move order');
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Orders</h2>
        <div className="flex gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {[{ value: '', label: 'All' }, { value: 'online', label: 'Online' }, { value: 'offline', label: 'Offline' }].map(t => (
              <button key={t.value} onClick={() => setParam('type', t.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${typeFilter === t.value ? 'bg-white shadow-sm text-secondary' : 'text-gray-500'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <select value={filter} onChange={(e) => setParam('status', e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
            <option value="">All Status</option>
            {STATUS_ORDER.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 -mt-3 mb-4">
          {chips.map(c => (
            <span key={c.key} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-secondary/10 text-secondary text-xs font-medium">
              {c.label}
              <button onClick={() => setParam(c.key, '')} className="w-4 h-4 rounded-full hover:bg-secondary/20 leading-none" aria-label={`Remove ${c.label} filter`}>×</button>
            </span>
          ))}
          <button onClick={() => setSearchParams(new URLSearchParams())} className="text-xs text-gray-500 hover:text-gray-700 underline">Clear all</button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Order #</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Type</th>
                {!isManager && <th className="px-4 py-3 text-left hidden md:table-cell">Store</th>}
                <th className="px-4 py-3 text-left hidden md:table-cell">Order Date</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Delivery Date</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Items</th>
                <th className="px-4 py-3 text-left">Total</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : bookings.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No orders found</td></tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium text-xs">{b.orderNumber}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => viewOrder(b)} className="text-left hover:underline">
                        <span className="font-medium text-xs text-blue-600">{b.customerName || '—'}</span>
                        {b.customerPhone && <p className="text-[10px] text-gray-400">{b.customerPhone}</p>}
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {b.orderType === 'offline' ? (
                        <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full text-xs">Offline</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs">Online</span>
                      )}
                    </td>
                    {!isManager && <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-600">{storeName(b.locationId) || <span className="text-gray-300">—</span>}</td>}
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">{new Date(b.createdAt || b.created_at || b.pickupDate || Date.now()).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">{b.estimatedDeliveryDate || b.estimated_delivery_date || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">{b.items?.length || 0}</td>
                    <td className="px-4 py-3 font-medium">₹{b.total}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(b.status)}`}>
                        {statusLabel(b.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(TRANSITIONS[b.status] || []).length > 0 ? (
                        <select
                          value={b.status}
                          onChange={(e) => updateStatus(b, e.target.value)}
                          className="text-xs border rounded px-2 py-1"
                          aria-label={`Next step for order ${b.orderNumber}`}
                        >
                          <option value={b.status}>{statusLabel(b.status)}</option>
                          {TRANSITIONS[b.status].map(s => (
                            <option key={s} value={s}>
                              {s === 'delivered' ? 'Confirm delivered…' : s === 'collected' ? 'Confirm collected…' : s === 'cancelled' ? 'Cancel…' : `→ ${statusLabel(s)}${needsReason(b.status, s) ? '…' : ''}`}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button onClick={() => setDialog({ kind: 'history', booking: b })} className="text-xs text-secondary hover:underline">History</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Previous</button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages} · {total} order{total === 1 ? '' : 's'}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Next</button>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl">
              <h3 className="font-bold text-lg">Order Details</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400 text-xs block">Order #</span><span className="font-mono font-medium">{selectedOrder.orderNumber}</span></div>
                <div><span className="text-gray-400 text-xs block">Invoice</span><span className="font-mono">{selectedOrder.invoiceNumber || '—'}</span></div>
                <div><span className="text-gray-400 text-xs block">Type</span>
                  {selectedOrder.orderType === 'offline' ? <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full text-xs">Offline</span> : <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs">Online</span>}
                </div>
                <div><span className="text-gray-400 text-xs block">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(selectedOrder.status)}`}>{statusLabel(selectedOrder.status)}</span>
                </div>
                <div><span className="text-gray-400 text-xs block">Order Date</span><span>{new Date(selectedOrder.createdAt || selectedOrder.created_at || Date.now()).toLocaleDateString('en-IN')}</span></div>
                <div><span className="text-gray-400 text-xs block">Delivery Date</span><span>{selectedOrder.estimatedDeliveryDate || selectedOrder.estimated_delivery_date || '—'}</span></div>
                <div className="col-span-2"><span className="text-gray-400 text-xs block">Store</span><span className="font-medium">{storeName(selectedOrder.locationId) || 'Not assigned'}</span></div>
                {selectedOrder.deliveredAt && (
                  <div className="col-span-2"><span className="text-gray-400 text-xs block">Delivered</span>
                    <span>{formatDateTime(selectedOrder.deliveredAt)}{selectedOrder.receivedBy ? ` · received by ${selectedOrder.receivedBy}` : ''}{selectedOrder.driver ? ` · by ${selectedOrder.driver.name}` : ''}</span>
                  </div>
                )}
                {selectedOrder.collectedAt && (
                  <div className="col-span-2"><span className="text-gray-400 text-xs block">Collected</span>
                    <span>{formatDateTime(selectedOrder.collectedAt)}{selectedOrder.collectedBy ? ` · by ${selectedOrder.collectedBy}` : ''}</span>
                  </div>
                )}
              </div>

              <button onClick={() => setDialog({ kind: 'history', booking: selectedOrder })} className="w-full py-2 border rounded-lg text-sm text-secondary hover:bg-gray-50">
                View order history
              </button>

              {!isManager && selectedOrder.orderType !== 'offline' && (
                <div className="flex items-center gap-2">
                  <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-sm bg-white" aria-label="Move to store">
                    <option value="">Move to another store…</option>
                    {locations.filter(l => l.isActive && l.id !== selectedOrder.locationId).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <button onClick={moveOrder} disabled={!moveTo} className="px-3 py-2 bg-secondary text-white rounded-lg text-sm font-medium disabled:opacity-40">Move</button>
                </div>
              )}

              {/* Customer */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Customer</p>
                <p className="font-semibold">{selectedOrder.customerName || '—'}</p>
                <p className="text-sm text-gray-500">{selectedOrder.customerPhone || '—'}</p>
                {selectedOrder.customerNote && <p className="text-xs text-gray-400 mt-1 italic">Note: {selectedOrder.customerNote}</p>}
              </div>

              {/* Items */}
              {selectedOrder.items?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Items ({selectedOrder.items.length})</p>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                        <div>
                          <span className="font-medium">{item.name}</span>
                          {item.garmentColor && <span className="ml-1 text-xs text-gray-400">({item.garmentColor})</span>}
                          {item.itemNote && <p className="text-xs text-orange-500">⚠ {item.itemNote}</p>}
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-gray-500">×{item.quantity}</span>
                          <span className="ml-2 font-medium">₹{item.lineTotal || item.line_total}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment */}
              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{selectedOrder.subtotal}</span></div>
                {parseFloat(selectedOrder.discount) > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount</span><span>-₹{selectedOrder.discount}</span></div>}
                {parseFloat(selectedOrder.gstAmount || selectedOrder.gst_amount || 0) > 0 && <div className="flex justify-between"><span className="text-gray-500">GST ({selectedOrder.gstRate || selectedOrder.gst_rate}%)</span><span>₹{selectedOrder.gstAmount || selectedOrder.gst_amount}</span></div>}
                <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span>₹{selectedOrder.total}</span></div>
                <div className="flex justify-between text-xs text-gray-400 pt-1">
                  <span>Payment: {selectedOrder.paymentMethodDetail || selectedOrder.payment_method_detail || selectedOrder.paymentMethod || '—'}</span>
                  <span>{selectedOrder.paymentStatus === 'paid' || selectedOrder.payment_status === 'paid' ? '✓ Paid' : '⏳ Pending'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {dialog?.kind === 'deliver' && <ConfirmDeliveredDialog booking={dialog.booking} drivers={drivers} onClose={() => setDialog(null)} onDone={afterDialog} />}
      {dialog?.kind === 'collect' && <ConfirmCollectedDialog booking={dialog.booking} onClose={() => setDialog(null)} onDone={afterDialog} />}
      {dialog?.kind === 'reason' && <ReasonDialog booking={dialog.booking} to={dialog.to} onClose={() => setDialog(null)} onDone={afterDialog} />}
      {dialog?.kind === 'history' && <OrderHistoryModal booking={dialog.booking} onClose={() => setDialog(null)} />}
    </div>
  );
}
