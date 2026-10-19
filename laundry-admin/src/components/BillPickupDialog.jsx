import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineSearch, HiOutlineTrash, HiOutlinePlus } from 'react-icons/hi';
import api from '../api/axios';
import { Dialog, Field, inputClass, SubmitButton, CancelButton } from './OrderWorkflow';
import { rupees } from '../utils/orderStatus';

/**
 * Bill a bulk pickup once its clothes are counted at the store. Catalogue items are priced by the server at the
 * store's price; anything else can be added as a custom line. Pickup & delivery charges and the member discount
 * are worked out by the server from the store's charge rule when the bill is saved.
 */
export default function BillPickupDialog({ booking, onClose, onDone }) {
  const [catalogue, setCatalogue] = useState(null);
  const [lines, setLines] = useState(() => (booking.items || []).map(i => ({
    key: i.id, itemId: i.itemId || null, name: i.name, price: Number(i.price), quantity: Number(i.quantity),
  })));
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState({ name: '', price: '', quantity: '1' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const cats = (await api.get('/categories')).data || [];
        const lists = await Promise.all(cats.map(async (c) => {
          try {
            const r = await api.get(`/categories/${c.id}/items`, { params: { limit: 200, locationId: booking.locationId || undefined } });
            return (r.data?.items || []).map(i => ({ id: i.id, name: i.name, price: parseFloat(i.price), category: c.name }));
          } catch { return []; }
        }));
        setCatalogue(lists.flat());
      } catch {
        setCatalogue([]);
      }
    })();
  }, [booking.locationId]);

  const matches = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!catalogue || !s) return [];
    return catalogue.filter(i => i.name.toLowerCase().includes(s) || (i.category || '').toLowerCase().includes(s)).slice(0, 8);
  }, [catalogue, query]);

  const addItem = (item) => {
    setLines(prev => {
      const at = prev.findIndex(l => l.itemId === item.id);
      if (at >= 0) return prev.map((l, i) => (i === at ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { key: `${item.id}-${Date.now()}`, itemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
    setQuery('');
  };

  const addCustom = () => {
    const price = Number(custom.price);
    const quantity = Number(custom.quantity);
    if (!custom.name.trim() || !(price >= 0) || custom.price === '' || !(quantity >= 1)) { setError('A custom line needs a name, a price and a quantity'); return; }
    setLines(prev => [...prev, { key: `c-${Date.now()}`, itemId: null, name: custom.name.trim(), price, quantity: Math.round(quantity) }]);
    setCustom({ name: '', price: '', quantity: '1' });
    setError('');
  };

  const setQty = (key, value) => setLines(prev => prev.map(l => (l.key === key ? { ...l, quantity: Math.max(1, Math.min(1000, Math.round(Number(value) || 1))) } : l)));
  const remove = (key) => setLines(prev => prev.filter(l => l.key !== key));

  const pieces = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = lines.reduce((n, l) => n + l.price * l.quantity, 0);

  const save = async () => {
    if (lines.length === 0) { setError('Add the counted items first'); return; }
    setBusy(true);
    setError('');
    try {
      const res = await api.put(`/admin/bookings/${booking.id}/bill`, {
        items: lines.map(l => (l.itemId ? { itemId: l.itemId, quantity: l.quantity } : { name: l.name, price: l.price, quantity: l.quantity })),
      });
      const d = res.data;
      toast.success(`Billed ${rupees(d.total)}${d.deliveryFee ? ` (incl. ${rupees(d.deliveryFee)} pickup & delivery)` : ''}`);
      onDone(d);
    } catch (err) {
      setError(err.message || 'Could not save the bill');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={`Bill bulk pickup · ${booking.orderNumber}`}
      subtitle="Add what was counted at the store. Saving again replaces the bill until the order is paid."
      onClose={onClose}
      wide
      footer={(
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton busy={busy} disabled={lines.length === 0} onClick={save} tone="bg-secondary hover:bg-secondary-dark">Save bill</SubmitButton>
        </>
      )}
    >
      <div className="rounded-xl bg-gray-50 p-3 text-sm flex flex-wrap justify-between gap-2">
        <span className="font-medium text-gray-800">{booking.customerName || 'Customer'}{booking.customerPhone ? ` · ${booking.customerPhone}` : ''}</span>
        <span className="text-gray-500">{booking.paymentMethod === 'cod' ? 'Pays cash on delivery' : 'Pays online in the app'}</span>
      </div>

      <Field label="Add catalogue item" hint={catalogue === null ? 'Loading the store\'s items…' : 'Priced at this store\'s price list.'}>
        <div className="relative">
          <HiOutlineSearch className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search shirt, saree, blanket…" className={`${inputClass} pl-9`} />
          {matches.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {matches.map(i => (
                <li key={i.id}>
                  <button type="button" onClick={() => addItem(i)} className="w-full flex justify-between px-3 py-2 text-sm hover:bg-primary/10 text-left">
                    <span>{i.name} <span className="text-xs text-gray-400">· {i.category}</span></span>
                    <span className="font-medium">{rupees(i.price)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>

      <div>
        <span className="block text-xs font-medium text-gray-600 mb-1">Custom line</span>
        <div className="grid grid-cols-6 gap-2">
          <input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="e.g. Curtain (large)" className={`${inputClass} col-span-3`} aria-label="Custom item name" />
          <input value={custom.price} onChange={(e) => setCustom({ ...custom, price: e.target.value })} inputMode="decimal" placeholder="₹ each" className={`${inputClass} col-span-1`} aria-label="Price each" />
          <input value={custom.quantity} onChange={(e) => setCustom({ ...custom, quantity: e.target.value.replace(/\D/g, '') })} inputMode="numeric" placeholder="Qty" className={`${inputClass} col-span-1`} aria-label="Quantity" />
          <button type="button" onClick={addCustom} className="col-span-1 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700" aria-label="Add custom line"><HiOutlinePlus className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="rounded-xl border divide-y">
        {lines.length === 0 ? (
          <p className="p-4 text-center text-sm text-gray-400">No items yet</p>
        ) : lines.map(l => (
          <div key={l.key} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="flex-1 min-w-0 truncate">{l.name}{!l.itemId && <span className="ml-1 text-[11px] text-gray-400">custom</span>}</span>
            <span className="text-gray-500 w-16 text-right">{rupees(l.price)}</span>
            <input value={l.quantity} onChange={(e) => setQty(l.key, e.target.value)} inputMode="numeric" className="w-14 px-2 py-1 border rounded text-center" aria-label={`Quantity of ${l.name}`} />
            <span className="w-20 text-right font-medium">{rupees(l.price * l.quantity)}</span>
            <button type="button" onClick={() => remove(l.key)} className="p-1 text-gray-400 hover:text-red-500" aria-label={`Remove ${l.name}`}><HiOutlineTrash className="w-4 h-4" /></button>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-primary/5 p-3 text-sm space-y-1">
        <div className="flex justify-between"><span className="text-gray-600">{pieces} piece{pieces === 1 ? '' : 's'} · items</span><span className="font-semibold">{rupees(subtotal)}</span></div>
        <p className="text-xs text-gray-500">Pickup &amp; delivery charge (if below the store's free-delivery threshold) and any member discount are added by the server when you save.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Dialog>
  );
}
