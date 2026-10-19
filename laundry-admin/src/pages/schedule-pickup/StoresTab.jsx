import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { Card, Toggle, ReadOnlyNote, Empty } from './ui';
import { rupees } from '../../utils/orderStatus';

/** Per-store pickup switch and booking window; partners, slot capacity and charges at a glance */
export default function StoresTab({ isAdmin, onChanged }) {
  const [stores, setStores] = useState(null);
  const [windows, setWindows] = useState({});
  const [globalMax, setGlobalMax] = useState(null);

  const load = useCallback(async () => {
    try {
      const [res, s] = await Promise.all([api.get('/admin/pickup/locations'), api.get('/admin/pickup/settings')]);
      setStores(res.data || []);
      setWindows(Object.fromEntries((res.data || []).map(l => [l.id, l.maxAdvanceDays ? String(l.maxAdvanceDays) : ''])));
      setGlobalMax(s.data.maxAdvanceDays);
    } catch (err) { toast.error(err.message || 'Could not load stores'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const update = async (store, changes, message) => {
    try {
      await api.put(`/admin/pickup/locations/${store.id}`, changes);
      toast.success(message);
      load();
      onChanged?.();
    } catch (err) { toast.error(err.message || 'Could not save'); }
  };

  if (!stores) return <p className="text-gray-400 text-center py-12">Loading…</p>;

  return (
    <div>
      {!isAdmin && <ReadOnlyNote />}
      <Card title="Stores" subtitle="Customers are matched to a store by their address pincode (Serviceable Areas).">
        {stores.length === 0 ? <Empty>No stores yet.</Empty> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {stores.map(s => {
              const value = windows[s.id] ?? '';
              const changed = value !== (s.maxAdvanceDays ? String(s.maxAdvanceDays) : '');
              const valid = value === '' || (Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 90);
              return (
                <div key={s.id} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-800">{s.name} <span className="text-xs font-mono text-gray-400">{s.code}</span></p>
                      {!s.isActive && <p className="text-xs text-red-500">Store inactive</p>}
                    </div>
                    <Toggle checked={s.pickupEnabled} disabled={!isAdmin} onChange={(v) => update(s, { pickupEnabled: v }, v ? `${s.name} is taking pickups` : `Pickups paused at ${s.name}`)} label={s.pickupEnabled ? 'Pickups on' : 'Pickups off'} />
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex-1">
                      <span className="block text-xs font-medium text-gray-600 mb-1">Booking window (days ahead)</span>
                      <input type="number" min={1} max={90} value={value} disabled={!isAdmin} placeholder={`Default (${globalMax ?? '—'})`} onChange={(e) => setWindows(w => ({ ...w, [s.id]: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50" />
                    </label>
                    {isAdmin && changed && (
                      <button disabled={!valid} onClick={() => update(s, { maxAdvanceDays: value === '' ? null : Number(value) }, 'Booking window saved')} className="px-3 py-2 bg-secondary text-white rounded-lg text-sm disabled:opacity-50">Save</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Link to="/delivery-boys" className="rounded-lg bg-gray-50 px-3 py-2 hover:bg-gray-100">
                      <b className="block text-base text-gray-800">{s.partners}</b>active pickup partner{s.partners === 1 ? '' : 's'}
                    </Link>
                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                      <b className="block text-base text-gray-800">{s.charges.charge ? rupees(s.charges.charge) : 'Free'}</b>
                      {s.charges.charge ? `below ${rupees(s.charges.freeAbove)} · ${s.charges.scope === 'store' ? 'store rule' : 'default rule'}` : 'pickup & delivery'}
                    </div>
                  </div>
                  {s.partners === 0 && s.pickupEnabled && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">No active pickup partners: bookings will wait in the queue until one is added.</p>}
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-4">Slot capacity per store is set on the Time slots tab (or the store's page under <Link to="/locations" className="text-secondary font-medium hover:underline">Locations</Link>).</p>
      </Card>
    </div>
  );
}
