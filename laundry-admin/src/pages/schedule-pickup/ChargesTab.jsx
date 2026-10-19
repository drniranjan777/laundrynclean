import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi';
import api from '../../api/axios';
import { useLocations } from '../../context/LocationContext';
import { Card, Field, Modal, Toggle, PrimaryButton, GhostButton, ReadOnlyNote, Empty, inputClass, prettyDay } from './ui';
import { rupees } from '../../utils/orderStatus';

const blankRule = { name: '', locationId: '', freeAbove: '250', minItemsFree: '', deliveryCharge: '50', pickupCharge: '0', effectiveFrom: '', effectiveTo: '', isActive: true };

/** Same rule as the server's chargesFor, for the examples only (the server always calculates the real charge) */
const chargeFor = (rule, subtotal, pieces) => {
  const below = subtotal < Number(rule.freeAbove) || (rule.minItemsFree !== null && rule.minItemsFree !== '' && pieces < Number(rule.minItemsFree));
  return below ? Number(rule.deliveryCharge) + Number(rule.pickupCharge) : 0;
};

/**
 * Pickup & delivery charge rules: the default rule, and store rules that replace it for one store (optionally
 * between dates). Only one active rule can apply to a store on a day.
 */
export default function ChargesTab({ isAdmin }) {
  const { locations } = useLocations();
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/pickup/delivery-charges');
      setData(res.data);
    } catch (err) { toast.error(err.message || 'Could not load charge rules'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (rule) => {
    if (!confirm(`Delete the rule "${rule.name}"?`)) return;
    try {
      await api.delete(`/admin/pickup/delivery-charges/${rule.id}`);
      toast.success('Rule deleted');
      load();
    } catch (err) { toast.error(err.message || 'Could not delete'); }
  };

  if (!data) return <p className="text-gray-400 text-center py-12">Loading…</p>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        {!isAdmin && <ReadOnlyNote />}
        <Card
          title="Charge rules"
          subtitle="Below the free-delivery amount (or with fewer pieces than the minimum) the order pays the pickup + delivery charge. Members with free delivery never pay it."
          actions={isAdmin && (
            <button onClick={() => setEditing({})} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
              <HiOutlinePlus className="w-4 h-4" /> Add rule
            </button>
          )}
        >
          {data.rules.length === 0 ? <Empty>No rules. A built-in ₹250 / ₹50 rule applies until you add one.</Empty> : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-[11px]">
                  <tr>
                    <th className="px-5 py-2.5 text-left">Rule</th>
                    <th className="px-3 py-2.5 text-left">Free from</th>
                    <th className="px-3 py-2.5 text-left">Charge below</th>
                    <th className="px-3 py-2.5 text-left hidden md:table-cell">Dates</th>
                    <th className="px-3 py-2.5 text-left">Status</th>
                    {isAdmin && <th className="px-5 py-2.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.rules.map(r => (
                    <tr key={r.id}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-800">{r.name}</p>
                        <p className="text-xs text-gray-500">{r.location ? r.location.name : 'Default · all stores without their own rule'}</p>
                      </td>
                      <td className="px-3 py-3">{rupees(r.freeAbove)}{r.minItemsFree ? <span className="block text-[11px] text-gray-500">and {r.minItemsFree}+ pieces</span> : null}</td>
                      <td className="px-3 py-3">
                        <span className="font-medium">{rupees(Number(r.deliveryCharge) + Number(r.pickupCharge))}</span>
                        <span className="block text-[11px] text-gray-500">{rupees(r.deliveryCharge)} delivery + {rupees(r.pickupCharge)} pickup</span>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600 hidden md:table-cell">{r.effectiveFrom || r.effectiveTo ? `${r.effectiveFrom ? prettyDay(r.effectiveFrom) : 'Any time'} – ${r.effectiveTo ? prettyDay(r.effectiveTo) : 'open-ended'}` : 'Always'}</td>
                      <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>{r.isActive ? 'Active' : 'Inactive'}</span></td>
                      {isAdmin && (
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <button onClick={() => setEditing(r)} className="p-1.5 text-gray-400 hover:text-blue-500" aria-label={`Edit ${r.name}`}><HiOutlinePencil className="w-4 h-4" /></button>
                          <button onClick={() => remove(r)} className="p-1.5 text-gray-400 hover:text-red-500" aria-label={`Delete ${r.name}`}><HiOutlineTrash className="w-4 h-4" /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <p className="text-xs text-gray-500">GST on orders follows <Link to="/gst-settings" className="text-secondary font-medium hover:underline">GST &amp; Invoice</Link> settings. App orders are charged when placed; bulk pickups when billed after pickup.</p>
      </div>

      <Card title="Applying today" subtitle="The rule each store's customers get, with examples." className="h-fit">
        {data.applying.length === 0 ? <Empty>No active stores.</Empty> : (
          <ul className="space-y-4">
            {data.applying.map(a => (
              <li key={a.locationId} className="text-sm">
                <p className="font-medium text-gray-800">{a.name}</p>
                <p className="text-xs text-gray-500 mb-1.5">{a.rule.name} ({a.rule.scope === 'store' ? 'store rule' : 'default'})</p>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[[Math.max(0, a.rule.freeAbove - 50), 12], [a.rule.freeAbove, Math.max(a.rule.minItemsFree || 0, 12)]].map(([amt, pcs]) => {
                    const c = chargeFor(a.rule, amt, pcs);
                    return (
                      <span key={amt} className="rounded-lg bg-gray-50 px-2 py-1.5">
                        {rupees(amt)} · {pcs} pcs<br /><b className={c ? 'text-amber-700' : 'text-green-700'}>{c ? `+${rupees(c)} charge` : 'Free pickup & delivery'}</b>
                      </span>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && <RuleDialog rule={editing.id ? editing : null} locations={locations} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function RuleDialog({ rule, locations, onClose, onSaved }) {
  const [form, setForm] = useState(() => (rule ? {
    name: rule.name, locationId: rule.locationId || '', freeAbove: String(Number(rule.freeAbove)), minItemsFree: rule.minItemsFree === null ? '' : String(rule.minItemsFree),
    deliveryCharge: String(Number(rule.deliveryCharge)), pickupCharge: String(Number(rule.pickupCharge)), effectiveFrom: rule.effectiveFrom || '', effectiveTo: rule.effectiveTo || '', isActive: rule.isActive,
  } : blankRule));
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const amountsOk = ['freeAbove', 'deliveryCharge', 'pickupCharge'].every(k => form[k] !== '' && Number(form[k]) >= 0) && (form.minItemsFree === '' || Number.isInteger(Number(form.minItemsFree)));
  const datesOk = !form.effectiveFrom || !form.effectiveTo || form.effectiveTo >= form.effectiveFrom;

  const save = async () => {
    if (!form.name.trim()) { toast.error('Give the rule a name'); return; }
    setBusy(true);
    const payload = {
      ...form, name: form.name.trim(), locationId: form.locationId || null, minItemsFree: form.minItemsFree === '' ? null : Number(form.minItemsFree),
      freeAbove: Number(form.freeAbove), deliveryCharge: Number(form.deliveryCharge), pickupCharge: Number(form.pickupCharge),
      effectiveFrom: form.effectiveFrom || null, effectiveTo: form.effectiveTo || null,
    };
    try {
      if (rule) await api.put(`/admin/pickup/delivery-charges/${rule.id}`, payload);
      else await api.post('/admin/pickup/delivery-charges', payload);
      toast.success('Charge rule saved');
      onSaved();
    } catch (err) { toast.error(err.message || 'Could not save'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={rule ? `Edit ${rule.name}` : 'Add charge rule'} onClose={onClose} wide footer={<><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton busy={busy} disabled={!amountsOk || !datesOk} onClick={save}>Save rule</PrimaryButton></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Name"><input value={form.name} maxLength={80} onChange={(e) => set('name', e.target.value)} className={inputClass} placeholder="e.g. Koramangala festive" /></Field>
        <Field label="Applies to">
          <select value={form.locationId} onChange={(e) => set('locationId', e.target.value)} className={inputClass}>
            <option value="">Default (all stores without their own rule)</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
        <Field label="Free pickup & delivery from (₹)" hint="Order amount at or above this is free"><input type="number" min={0} value={form.freeAbove} onChange={(e) => set('freeAbove', e.target.value)} className={inputClass} /></Field>
        <Field label="…and at least (pieces)" hint="Optional minimum pieces for free delivery"><input type="number" min={0} value={form.minItemsFree} onChange={(e) => set('minItemsFree', e.target.value)} className={inputClass} placeholder="No minimum" /></Field>
        <Field label="Delivery charge (₹)"><input type="number" min={0} value={form.deliveryCharge} onChange={(e) => set('deliveryCharge', e.target.value)} className={inputClass} /></Field>
        <Field label="Pickup charge (₹)"><input type="number" min={0} value={form.pickupCharge} onChange={(e) => set('pickupCharge', e.target.value)} className={inputClass} /></Field>
        <Field label="Effective from" hint="Empty = already in effect"><input type="date" value={form.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} className={inputClass} /></Field>
        <Field label="Effective until" hint="Empty = no end date"><input type="date" value={form.effectiveTo} min={form.effectiveFrom || undefined} onChange={(e) => set('effectiveTo', e.target.value)} className={inputClass} /></Field>
      </div>
      <Toggle checked={form.isActive} onChange={(v) => set('isActive', v)} label="Active" hint="Two active rules for the same store can't overlap in dates." />
      {amountsOk && (
        <p className="text-sm rounded-lg bg-primary/5 p-3 text-gray-700">
          Orders below <b>{rupees(form.freeAbove)}</b>{form.minItemsFree ? <> or with fewer than <b>{form.minItemsFree}</b> pieces</> : null} pay <b>{rupees(Number(form.deliveryCharge) + Number(form.pickupCharge))}</b>. Larger orders are picked up and delivered free.
        </p>
      )}
      {!datesOk && <p className="text-sm text-red-600">The end date must be after the start date.</p>}
    </Modal>
  );
}
