import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  HiX, HiOutlineCheckCircle, HiOutlineUserAdd, HiOutlineExclamationCircle, HiOutlineCash, HiOutlineSwitchHorizontal,
  HiOutlineShoppingBag, HiOutlinePencilAlt, HiOutlineReply, HiOutlineBan, HiOutlineTruck, HiOutlineOfficeBuilding,
} from 'react-icons/hi';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import {
  statusLabel, statusBadge, cashDue, formatDateTime, toLocalInput, CORRECTIONS,
} from '../utils/orderStatus';

/** Centered dialog shell used by all order actions */
function Dialog({ title, subtitle, onClose, children, footer, wide = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-xl' : 'max-w-md'} max-h-[92vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b">
          <div>
            <h3 className="font-semibold text-gray-800">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Close"><HiX className="w-5 h-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
  </label>
);

const inputClass = 'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary';

/** Who the order is for, what's in it and how it's paid */
function OrderSummary({ booking }) {
  const items = booking.items || [];
  const pieces = items.reduce((n, i) => n + (Number(i.quantity) || 0), 0);
  return (
    <div className="rounded-xl bg-gray-50 p-3 text-sm space-y-1">
      <div className="flex justify-between gap-3">
        <span className="font-medium text-gray-800">{booking.customerName || 'Customer'}</span>
        <span className="text-gray-500">{booking.customerPhone || ''}</span>
      </div>
      <div className="flex justify-between gap-3 text-gray-600">
        <span>{pieces || items.length} piece{(pieces || items.length) === 1 ? '' : 's'} · {booking.orderType === 'offline' ? 'Store order' : 'Online order'}</span>
        <span className="font-semibold text-gray-800">₹{Number(booking.total).toFixed(2)}</span>
      </div>
      <div className="text-xs text-gray-500">
        Payment: {booking.paymentStatus === 'paid' ? 'Paid' : booking.paymentStatus === 'refunded' ? 'Refunded' : `${booking.paymentMethod === 'cod' ? 'Cash' : (booking.paymentMethod || '').toUpperCase()} · not paid yet`}
      </div>
    </div>
  );
}

/** Optional cash payment taken at the handover; payment is never changed unless this is ticked */
function CashTick({ booking, checked, onChange }) {
  const due = cashDue(booking);
  if (due <= 0) {
    return <p className="text-xs text-gray-500">Payment status stays as it is ({booking.paymentStatus === 'paid' ? 'paid' : booking.paymentStatus}).</p>;
  }
  return (
    <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm cursor-pointer">
      <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="font-medium text-amber-800">Cash ₹{due.toFixed(2)} received now</span>
        <span className="block text-xs text-amber-700">Leave unticked to keep the payment pending. Payment is recorded separately from the handover.</span>
      </span>
    </label>
  );
}

const SubmitButton = ({ busy, disabled, onClick, children, tone = 'bg-green-600 hover:bg-green-700' }) => (
  <button
    onClick={onClick}
    disabled={busy || disabled}
    className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${tone}`}
  >
    {busy ? 'Saving…' : children}
  </button>
);
const CancelButton = ({ onClick }) => <button onClick={onClick} className="px-4 py-2 rounded-lg text-sm border text-gray-600 hover:bg-gray-50">Cancel</button>;

/** Confirm delivered: who received it, when, the delivery partner, notes and (optionally) cash received */
export function ConfirmDeliveredDialog({ booking, drivers = [], onClose, onDone }) {
  const [receiverName, setReceiverName] = useState(booking.receivedBy || booking.customerName || '');
  const [deliveredAt, setDeliveredAt] = useState(toLocalInput());
  const [partnerId, setPartnerId] = useState(booking.driverId || '');
  const [note, setNote] = useState('');
  const [cash, setCash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const storeDrivers = drivers.filter(d => !booking.locationId || !d.locationId || d.locationId === booking.locationId);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/admin/bookings/${booking.id}/deliver`, {
        receiverName,
        deliveredAt: new Date(deliveredAt).toISOString(),
        partnerId: partnerId || undefined,
        note: note || undefined,
        cashCollected: cash ? cashDue(booking) : undefined,
      });
      toast.success(res.message || 'Delivered');
      onDone();
    } catch (err) {
      setError(err.message || 'Could not confirm the delivery');
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={`Confirm delivered · Order ${booking.orderNumber}`}
      subtitle="Recorded in the order history and shown to the customer."
      onClose={onClose}
      footer={<><CancelButton onClick={onClose} /><SubmitButton busy={busy} disabled={receiverName.trim().length < 2} onClick={submit}>Confirm delivered</SubmitButton></>}
    >
      <OrderSummary booking={booking} />
      <Field label="Received by *" hint="The customer, or who took the clothes (e.g. family member, security).">
        <input className={inputClass} value={receiverName} maxLength={100} onChange={(e) => setReceiverName(e.target.value)} autoFocus />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Delivered at">
          <input type="datetime-local" className={inputClass} value={deliveredAt} max={toLocalInput()} onChange={(e) => setDeliveredAt(e.target.value)} />
        </Field>
        <Field label="Delivery partner">
          <select className={inputClass} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">{booking.driverId ? 'Assigned partner' : 'None (delivered by staff)'}</option>
            {storeDrivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Notes">
        <textarea className={inputClass} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Left with the security guard" />
      </Field>
      <CashTick booking={booking} checked={cash} onChange={setCash} />
      <p className="text-[11px] text-gray-400">Proof photos taken in the driver app appear in the order history.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Dialog>
  );
}

/** Confirm collected at the shop: who collected it, when, notes and (optionally) cash received */
export function ConfirmCollectedDialog({ booking, onClose, onDone }) {
  const { user } = useAuth();
  const [collectedBy, setCollectedBy] = useState(booking.customerName || '');
  const [collectedAt, setCollectedAt] = useState(toLocalInput());
  const [note, setNote] = useState('');
  const [cash, setCash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/admin/bookings/${booking.id}/collect`, {
        collectedBy,
        collectedAt: new Date(collectedAt).toISOString(),
        note: note || undefined,
        cashCollected: cash ? cashDue(booking) : undefined,
      });
      toast.success(res.message || 'Collected');
      onDone();
    } catch (err) {
      setError(err.message || 'Could not confirm the collection');
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={`Confirm collected · Order ${booking.orderNumber}`}
      subtitle={`Handed over at the shop by ${user?.name || 'you'}.`}
      onClose={onClose}
      footer={<><CancelButton onClick={onClose} /><SubmitButton busy={busy} disabled={collectedBy.trim().length < 2} onClick={submit}>Confirm collected</SubmitButton></>}
    >
      <OrderSummary booking={booking} />
      <Field label="Collected by *" hint="The customer, or the person collecting for them.">
        <input className={inputClass} value={collectedBy} maxLength={100} onChange={(e) => setCollectedBy(e.target.value)} autoFocus />
      </Field>
      <Field label="Collected at">
        <input type="datetime-local" className={inputClass} value={collectedAt} max={toLocalInput()} onChange={(e) => setCollectedAt(e.target.value)} />
      </Field>
      <Field label="Notes">
        <textarea className={inputClass} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Checked the bill copy" />
      </Field>
      <CashTick booking={booking} checked={cash} onChange={setCash} />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Dialog>
  );
}

/**
 * A status change that needs a reason: cancelling, a failed delivery back to Ready, a shop pickup switched to delivery.
 * `to` is the new status.
 */
export function ReasonDialog({ booking, to, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cancelling = to === 'cancelled';
  const refund = cancelling && booking.orderType === 'online' && booking.paymentStatus === 'paid' && ['wallet', 'card', 'upi'].includes(booking.paymentMethod);
  const copy = cancelling
    ? { title: `Cancel order ${booking.orderNumber}?`, label: 'Reason for cancelling *', button: 'Cancel order', placeholder: 'e.g. Customer called to cancel' }
    : booking.status === 'out_for_delivery'
      ? { title: `Delivery not done · Order ${booking.orderNumber}`, label: 'What happened? *', button: 'Move back to Ready', placeholder: 'e.g. Customer not at home' }
      : { title: `Deliver instead · Order ${booking.orderNumber}`, label: 'Reason *', button: 'Move back to Ready', placeholder: 'e.g. Customer asked for home delivery' };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/bookings/${booking.id}/status`, { status: to, reason });
      toast.success(cancelling ? 'Order cancelled' : 'Moved back to Ready');
      onDone();
    } catch (err) {
      setError(err.message || 'Could not update the order');
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={copy.title}
      onClose={onClose}
      footer={<><CancelButton onClick={onClose} /><SubmitButton busy={busy} disabled={reason.trim().length < 3} onClick={submit} tone={cancelling ? 'bg-red-600 hover:bg-red-700' : 'bg-secondary hover:bg-secondary-dark'}>{copy.button}</SubmitButton></>}
    >
      <OrderSummary booking={booking} />
      {refund && <p className="text-sm text-gray-600">The ₹{Number(booking.total).toFixed(2)} the customer paid goes back to their NClean wallet.</p>}
      <Field label={copy.label}>
        <textarea className={inputClass} rows={3} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={copy.placeholder} autoFocus />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Dialog>
  );
}

/** Admin-only: undo a mistaken status (e.g. confirmed as delivered by mistake), with a reason */
export function CorrectionDialog({ booking, onClose, onDone }) {
  const options = CORRECTIONS[booking.status] || [];
  const [to, setTo] = useState(options[0] || '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/admin/bookings/${booking.id}/correct-status`, { status: to, reason });
      toast.success(res.message || 'Status corrected');
      onDone();
    } catch (err) {
      setError(err.message || 'Could not correct the status');
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={`Correct status · Order ${booking.orderNumber}`}
      subtitle="For mistakes only. Recorded as a correction in the order history."
      onClose={onClose}
      footer={<><CancelButton onClick={onClose} /><SubmitButton busy={busy} disabled={!to || reason.trim().length < 5} onClick={submit} tone="bg-secondary hover:bg-secondary-dark">Correct status</SubmitButton></>}
    >
      <div className="flex items-center gap-2 text-sm">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(booking.status)}`}>{statusLabel(booking.status)}</span>
        <span className="text-gray-400">→</span>
        <select className={`${inputClass} max-w-[220px]`} value={to} onChange={(e) => setTo(e.target.value)}>
          {options.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </div>
      {(booking.status === 'delivered' || booking.status === 'collected') && (
        <p className="text-xs text-gray-500">The recorded {booking.status === 'delivered' ? 'delivery' : 'collection'} details are cleared. Payments are not changed.</p>
      )}
      <Field label="Reason *">
        <textarea className={inputClass} rows={3} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Marked delivered on the wrong order" autoFocus />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Dialog>
  );
}

// What a driver's status change means on the road
const DRIVER_ACTIONS = { picked_up: 'Picked up from the customer', in_process: 'Handed to the store', out_for_delivery: 'Out for delivery', delivered: 'Delivered' };

/** How one history row reads */
const describeEvent = (e) => {
  switch (e.type) {
    case 'driver_assigned':
      return { icon: HiOutlineUserAdd, tone: 'bg-blue-50 text-blue-600', title: e.note || 'Delivery partner assigned', hideNote: true };
    case 'pickup_failed':
      return { icon: HiOutlineExclamationCircle, tone: 'bg-red-50 text-red-600', title: 'Pickup attempt failed' };
    case 'delivery_failed':
      return { icon: HiOutlineExclamationCircle, tone: 'bg-red-50 text-red-600', title: 'Delivery attempt failed' };
    case 'cash_collected':
      return { icon: HiOutlineCash, tone: 'bg-green-50 text-green-600', title: `Cash received ₹${Number(e.amount).toFixed(2)}` };
    case 'correction':
      return { icon: HiOutlinePencilAlt, tone: 'bg-amber-50 text-amber-700', title: 'Status corrected' };
    case 'billed':
      return { icon: HiOutlineCash, tone: 'bg-teal-50 text-teal-700', title: `Bulk pickup billed ₹${Number(e.amount).toFixed(2)}` };
    default: {
      if (e.toStatus === 'delivered') return { icon: HiOutlineTruck, tone: 'bg-green-50 text-green-600', title: 'Delivered' };
      if (e.toStatus === 'collected') return { icon: HiOutlineOfficeBuilding, tone: 'bg-green-50 text-green-600', title: 'Collected at the shop' };
      if (e.toStatus === 'cancelled') return { icon: HiOutlineBan, tone: 'bg-red-50 text-red-600', title: 'Cancelled' };
      if (e.fromStatus && ['out_for_delivery', 'ready_for_pickup'].includes(e.fromStatus) && e.toStatus === 'ready') {
        return { icon: HiOutlineReply, tone: 'bg-amber-50 text-amber-700', title: 'Back to Ready' };
      }
      const byDriver = e.actor?.role === 'driver';
      return {
        icon: e.toStatus === 'ready' || e.toStatus === 'ready_for_pickup' ? HiOutlineCheckCircle : HiOutlineSwitchHorizontal,
        tone: 'bg-gray-100 text-gray-600',
        title: byDriver ? (DRIVER_ACTIONS[e.toStatus] || statusLabel(e.toStatus)) : `Marked ${statusLabel(e.toStatus)}`,
      };
    }
  }
};

const roleName = (role) => ({ admin: 'Admin', manager: 'Store manager', driver: 'Delivery partner', customer: 'Customer' }[role] || role);

/**
 * Chronological order history: placed → each status change (previous → new), who did it (staff or delivery
 * partner), the partner, who received it, reasons, notes, cash and proof photos.
 */
export function OrderHistoryModal({ booking, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/admin/bookings/${booking.id}/events`);
        setData(res.data);
      } catch (err) {
        setError(err.message || 'Failed to load the history');
      }
    })();
  }, [booking.id]);

  const summary = data?.booking || booking;
  const events = data ? [...data.events].reverse() : [];

  return (
    <Dialog title={`Order ${booking.orderNumber} · history`} subtitle="Oldest first: every status change with who made it and why." onClose={onClose} wide>
      {error ? (
        <p className="text-center text-red-500 text-sm py-6">{error}</p>
      ) : data === null ? (
        <p className="text-center text-gray-400 text-sm py-6">Loading…</p>
      ) : (
        <>
          <div className="rounded-xl bg-gray-50 p-3 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(summary.status)}`}>{statusLabel(summary.status)}</span>
            <span className="text-gray-700">{summary.customerName || 'Customer'} {summary.customerPhone ? `· ${summary.customerPhone}` : ''}</span>
            {summary.driver && <span className="text-gray-500">Partner: {summary.driver.name}</span>}
            {summary.deliveredAt && <span className="text-gray-500">Delivered {formatDateTime(summary.deliveredAt)}{summary.receivedBy ? ` to ${summary.receivedBy}` : ''}</span>}
            {summary.collectedAt && <span className="text-gray-500">Collected {formatDateTime(summary.collectedAt)}{summary.collectedBy ? ` by ${summary.collectedBy}` : ''}</span>}
          </div>
          <ol className="relative border-l border-gray-200 ml-3 space-y-5">
            <li className="ml-6">
              <span className="absolute -left-3.5 flex items-center justify-center w-7 h-7 rounded-full ring-4 ring-white bg-secondary/10 text-secondary">
                <HiOutlineShoppingBag className="w-4 h-4" />
              </span>
              <p className="text-sm font-medium text-gray-800">Order placed</p>
              <p className="text-xs text-gray-500">{summary.orderType === 'offline' ? 'Billed at the store' : summary.bookingType === 'bulk_pickup' ? 'Schedule Pickup (bulk) from the customer app' : 'From the customer app'}</p>
              <p className="text-[11px] text-gray-400 mt-1">{formatDateTime(summary.createdAt)}</p>
            </li>
            {events.map((e) => {
              const d = describeEvent(e);
              const Icon = d.icon;
              return (
                <li key={e.id} className="ml-6">
                  <span className={`absolute -left-3.5 flex items-center justify-center w-7 h-7 rounded-full ring-4 ring-white ${d.tone}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <p className="text-sm font-medium text-gray-800">{d.title}</p>
                  {e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus && (
                    <p className="text-xs mt-0.5 flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded ${statusBadge(e.fromStatus)}`}>{statusLabel(e.fromStatus)}</span>
                      <span className="text-gray-400">→</span>
                      <span className={`px-1.5 py-0.5 rounded ${statusBadge(e.toStatus)}`}>{statusLabel(e.toStatus)}</span>
                    </p>
                  )}
                  {e.receiverName && <p className="text-xs text-gray-700 mt-1">{e.toStatus === 'collected' ? 'Collected by' : 'Received by'}: <span className="font-medium">{e.receiverName}</span></p>}
                  {e.partner && <p className="text-xs text-gray-600">Delivery partner: {e.partner.name}</p>}
                  {e.reason && <p className="text-xs text-gray-700 mt-0.5">Reason: {e.reason}</p>}
                  {e.itemCount !== null && e.itemCount !== undefined && <p className="text-xs text-gray-600 mt-0.5">{e.itemCount} piece{e.itemCount === 1 ? '' : 's'} counted</p>}
                  {!d.hideNote && e.note && <p className="text-xs text-gray-600 italic mt-0.5">"{e.note}"</p>}
                  {e.photoUrl && (
                    <a href={e.photoUrl} target="_blank" rel="noreferrer" className="inline-block mt-1.5" title="Open photo">
                      <img src={e.photoUrl} alt="Proof" className="w-16 h-16 object-cover rounded-lg border" />
                    </a>
                  )}
                  <p className="text-[11px] text-gray-400 mt-1">
                    {e.actor ? `${e.actor.name || 'Someone'} (${roleName(e.actor.role)})` : 'System'} · {formatDateTime(e.createdAt)}
                  </p>
                </li>
              );
            })}
          </ol>
          {events.length === 0 && <p className="text-xs text-gray-400">No status changes recorded yet.</p>}
        </>
      )}
    </Dialog>
  );
}

// Shared with the other order dialogs (bulk pickup billing)
export { Dialog, Field, inputClass, SubmitButton, CancelButton };
