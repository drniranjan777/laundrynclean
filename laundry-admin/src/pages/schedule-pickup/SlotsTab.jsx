import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi';
import api from '../../api/axios';
import { useLocations } from '../../context/LocationContext';
import { Card, Field, Modal, Toggle, DayPicker, PrimaryButton, GhostButton, ReadOnlyNote, Empty, inputClass, time12, daysText, prettyDay, addDays } from './ui';

const blankSlot = { label: '', startTime: '09:00', endTime: '11:00', maxBookings: '20', days: [0, 1, 2, 3, 4, 5, 6], allLocations: true, isActive: true, locations: {} };

/**
 * Time slots customers choose from: times, weekdays, stores and how many pickups each takes per day, plus
 * date-specific capacity (more riders on a busy day, or 0 to mark a slot unavailable / full).
 */
export default function SlotsTab({ isAdmin }) {
  const { locations } = useLocations();
  const [slots, setSlots] = useState(null);
  const [overrides, setOverrides] = useState([]);
  const [editing, setEditing] = useState(null); // slot or {} for new
  const [overrideForm, setOverrideForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, o] = await Promise.all([api.get('/admin/pickup/slots'), api.get('/admin/pickup/slot-overrides')]);
      setSlots(s.data || []);
      setOverrides(o.data || []);
    } catch (err) { toast.error(err.message || 'Could not load time slots'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleActive = async (slot) => {
    try {
      await api.put(`/admin/pickup/slots/${slot.id}`, { isActive: !slot.isActive });
      toast.success(slot.isActive ? 'Slot disabled; customers no longer see it' : 'Slot enabled');
      load();
    } catch (err) { toast.error(err.message || 'Could not update'); }
  };
  const remove = async (slot) => {
    if (!confirm(`Delete the ${slot.label} slot?`)) return;
    try {
      await api.delete(`/admin/pickup/slots/${slot.id}`);
      toast.success('Slot deleted');
      load();
    } catch (err) { toast.error(err.message || 'Could not delete'); }
  };
  const removeOverride = async (o) => {
    try {
      await api.delete(`/admin/pickup/slot-overrides/${o.id}`);
      toast.success('Back to the normal capacity');
      load();
    } catch (err) { toast.error(err.message || 'Could not remove'); }
  };

  if (!slots) return <p className="text-gray-400 text-center py-12">Loading…</p>;
  const storeName = (id) => locations.find(l => l.id === id)?.name || 'Store';

  return (
    <div className="space-y-4">
      {!isAdmin && <ReadOnlyNote />}
      <Card
        title="Time slots"
        subtitle="Customers see active slots for the chosen date and store; a full slot is shown but can't be booked."
        actions={isAdmin && (
          <button onClick={() => setEditing({})} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
            <HiOutlinePlus className="w-4 h-4" /> Add slot
          </button>
        )}
      >
        {slots.length === 0 ? <Empty>No time slots yet. Add one so customers can book.</Empty> : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-[11px]">
                <tr>
                  <th className="px-5 py-2.5 text-left">Slot</th>
                  <th className="px-3 py-2.5 text-left">Days</th>
                  <th className="px-3 py-2.5 text-left">Capacity / day</th>
                  <th className="px-3 py-2.5 text-left hidden md:table-cell">Stores</th>
                  <th className="px-3 py-2.5 text-left">Upcoming</th>
                  <th className="px-3 py-2.5 text-left">Status</th>
                  {isAdmin && <th className="px-5 py-2.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {slots.map(s => (
                  <tr key={s.id} className={s.isActive ? '' : 'bg-gray-50/60'}>
                    <td className="px-5 py-3">
                      <p className={`font-medium ${s.isActive ? 'text-gray-800' : 'text-gray-400'}`}>{s.label}</p>
                      <p className="text-xs text-gray-500">{time12(s.startTime)} – {time12(s.endTime)}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-600">{daysText(s.days)}</td>
                    <td className="px-3 py-3">
                      <span className="font-medium">{s.maxBookings}</span>
                      {s.locations.length > 0 && <span className="block text-[11px] text-gray-500">{s.locations.map(l => `${storeName(l.locationId)}: ${l.maxBookings}`).join(' · ')}</span>}
                    </td>
                    <td className="px-3 py-3 text-gray-600 hidden md:table-cell">{s.allLocations ? 'All stores' : `${s.locations.filter(l => l.maxBookings > 0).length} store(s)`}</td>
                    <td className="px-3 py-3">{s.upcomingBookings > 0 ? <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">{s.upcomingBookings}</span> : <span className="text-gray-300">0</span>}</td>
                    <td className="px-3 py-3">
                      <button disabled={!isAdmin} onClick={() => toggleActive(s)} className={`px-2 py-1 rounded-full text-xs font-medium ${s.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'} ${isAdmin ? '' : 'cursor-default'}`}>
                        {s.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button onClick={() => setEditing(s)} className="p-1.5 text-gray-400 hover:text-blue-500" aria-label={`Edit ${s.label}`}><HiOutlinePencil className="w-4 h-4" /></button>
                        <button onClick={() => remove(s)} className="p-1.5 text-gray-400 hover:text-red-500" aria-label={`Delete ${s.label}`}><HiOutlineTrash className="w-4 h-4" /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Capacity on specific dates"
        subtitle="Overrides the slot's normal capacity for one date. 0 marks the slot unavailable (shown as closed)."
        actions={isAdmin && <button onClick={() => setOverrideForm(true)} className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"><HiOutlinePlus className="w-4 h-4" /> Set date capacity</button>}
      >
        {overrides.length === 0 ? <Empty>No date-specific capacity set.</Empty> : (
          <ul className="divide-y">
            {overrides.map(o => (
              <li key={o.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-28 font-medium text-gray-800">{prettyDay(o.date)}</span>
                <span className="flex-1 text-gray-600">{o.timeSlot?.label} · {o.location?.name || 'All stores'}{o.reason ? ` · ${o.reason}` : ''}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.maxBookings === 0 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{o.maxBookings === 0 ? 'Unavailable' : `${o.maxBookings} pickups`}</span>
                {isAdmin && <button onClick={() => removeOverride(o)} className="p-1.5 text-gray-400 hover:text-red-500" aria-label="Remove override"><HiOutlineTrash className="w-4 h-4" /></button>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && <SlotDialog slot={editing.id ? editing : null} locations={locations} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {overrideForm && <OverrideDialog slots={slots} locations={locations} onClose={() => setOverrideForm(false)} onSaved={() => { setOverrideForm(false); load(); }} />}
    </div>
  );
}

function SlotDialog({ slot, locations, onClose, onSaved }) {
  const [form, setForm] = useState(() => (slot ? {
    label: slot.label, startTime: slot.startTime, endTime: slot.endTime, maxBookings: String(slot.maxBookings), days: slot.days,
    allLocations: slot.allLocations, isActive: slot.isActive,
    locations: Object.fromEntries(slot.locations.map(l => [l.locationId, String(l.maxBookings)])),
  } : blankSlot));
  const [overlap, setOverlap] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const timesOk = form.startTime && form.endTime && form.startTime < form.endTime;

  const save = async (allowOverlap = false) => {
    if (!timesOk) { toast.error('The start time must be before the end time'); return; }
    if (form.days.length === 0) { toast.error('Choose at least one day'); return; }
    setBusy(true);
    const payload = {
      label: form.label.trim() || undefined,
      startTime: form.startTime, endTime: form.endTime, maxBookings: Number(form.maxBookings), days: form.days,
      allLocations: form.allLocations, isActive: form.isActive, allowOverlap,
      locations: locations.map(l => ({ locationId: l.id, maxBookings: form.locations[l.id] === undefined || form.locations[l.id] === '' ? null : Number(form.locations[l.id]) })),
    };
    try {
      if (slot) await api.put(`/admin/pickup/slots/${slot.id}`, payload);
      else await api.post('/admin/pickup/slots', payload);
      toast.success(slot ? 'Slot saved' : 'Slot added');
      onSaved();
    } catch (err) {
      if (/Overlaps/.test(err.message || '')) setOverlap(err.message);
      else toast.error(err.message || 'Could not save');
    } finally { setBusy(false); }
  };

  return (
    <Modal
      title={slot ? `Edit ${slot.label}` : 'Add time slot'}
      subtitle="Orders already booked keep their slot."
      onClose={onClose}
      wide
      footer={(
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          {overlap && <button onClick={() => save(true)} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600">Save anyway</button>}
          <PrimaryButton busy={busy} disabled={!timesOk} onClick={() => save(false)}>{slot ? 'Save slot' : 'Add slot'}</PrimaryButton>
        </>
      )}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="Start"><input type="time" value={form.startTime} onChange={(e) => { set('startTime', e.target.value); setOverlap(''); }} className={inputClass} /></Field>
        <Field label="End"><input type="time" value={form.endTime} onChange={(e) => { set('endTime', e.target.value); setOverlap(''); }} className={inputClass} /></Field>
        <Field label="Pickups per day" hint="Per store"><input type="number" min={0} max={10000} value={form.maxBookings} onChange={(e) => set('maxBookings', e.target.value)} className={inputClass} /></Field>
        <Field label="Label" hint="Optional"><input value={form.label} maxLength={60} onChange={(e) => set('label', e.target.value)} placeholder={timesOk ? `${time12(form.startTime)} - ${time12(form.endTime)}` : ''} className={inputClass} /></Field>
      </div>
      {!timesOk && <p className="text-sm text-red-600">The start time must be before the end time.</p>}
      <div>
        <span className="block text-xs font-medium text-gray-600 mb-2">Offered on</span>
        <DayPicker value={form.days} onChange={(v) => { set('days', v); setOverlap(''); }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Toggle checked={form.isActive} onChange={(v) => set('isActive', v)} label="Active" hint="Disabled slots are hidden from customers." />
        <Toggle checked={form.allLocations} onChange={(v) => set('allLocations', v)} label="All stores" hint="Off: only stores with their own capacity below." />
      </div>
      <div>
        <span className="block text-xs font-medium text-gray-600 mb-1">Store capacity</span>
        <p className="text-[11px] text-gray-400 mb-2">Leave empty to use {form.maxBookings || 0} per day; 0 means the store doesn't offer this slot.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {locations.map(l => (
            <label key={l.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-gray-700">{l.name}</span>
              <input type="number" min={0} max={10000} value={form.locations[l.id] ?? ''} onChange={(e) => set('locations', { ...form.locations, [l.id]: e.target.value })} placeholder={form.allLocations ? String(form.maxBookings || 0) : '—'} className="w-24 px-2 py-1.5 border rounded-lg text-sm" aria-label={`Capacity at ${l.name}`} />
            </label>
          ))}
        </div>
      </div>
      {overlap && <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">{overlap}</p>}
    </Modal>
  );
}

function OverrideDialog({ slots, locations, onClose, onSaved }) {
  const tomorrow = addDays(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), 1);
  const [form, setForm] = useState({ timeSlotId: slots.find(s => s.isActive)?.id || '', date: tomorrow, locationId: '', maxBookings: '0', reason: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/admin/pickup/slot-overrides', { ...form, locationId: form.locationId || null, maxBookings: Number(form.maxBookings) });
      toast.success(Number(form.maxBookings) === 0 ? 'Slot marked unavailable for that date' : 'Capacity set for that date');
      onSaved();
    } catch (err) { toast.error(err.message || 'Could not save'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Capacity on a date" onClose={onClose} footer={<><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton busy={busy} disabled={!form.timeSlotId || !form.date} onClick={save}>Save</PrimaryButton></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Time slot" className="col-span-2">
          <select value={form.timeSlotId} onChange={(e) => set('timeSlotId', e.target.value)} className={inputClass}>
            {slots.map(s => <option key={s.id} value={s.id}>{s.label}{s.isActive ? '' : ' (disabled)'}</option>)}
          </select>
        </Field>
        <Field label="Date"><input type="date" min={tomorrow} value={form.date} onChange={(e) => set('date', e.target.value)} className={inputClass} /></Field>
        <Field label="Store">
          <select value={form.locationId} onChange={(e) => set('locationId', e.target.value)} className={inputClass}>
            <option value="">All stores</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
        <Field label="Pickups that day" hint="0 = unavailable / full"><input type="number" min={0} max={10000} value={form.maxBookings} onChange={(e) => set('maxBookings', e.target.value)} className={inputClass} /></Field>
        <Field label="Reason" hint="Internal note"><input value={form.reason} maxLength={255} onChange={(e) => set('reason', e.target.value)} className={inputClass} placeholder="e.g. Rider on leave" /></Field>
      </div>
    </Modal>
  );
}
