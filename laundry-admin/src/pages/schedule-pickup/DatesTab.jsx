import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineTrash } from 'react-icons/hi';
import api from '../../api/axios';
import { useLocations } from '../../context/LocationContext';
import { Card, Field, Modal, PrimaryButton, GhostButton, ReadOnlyNote, Empty, WEEKDAYS, inputClass, addDays, weekdayOf, prettyDay } from './ui';

const DAYS_SHOWN = 42;

/**
 * Calendar of the coming weeks as customers see it: outside the window, closed weekdays, holidays and extra open
 * days. Clicking a date closes or opens it (for all stores or one store).
 */
export default function DatesTab({ isAdmin }) {
  const { locations, isManager, current } = useLocations();
  const [settings, setSettings] = useState(null);
  const [exceptions, setExceptions] = useState([]);
  const [storeWindows, setStoreWindows] = useState({});
  const [scope, setScope] = useState(isManager ? (current?.id || '') : '');
  const [editing, setEditing] = useState(null); // { date, existing }

  const load = useCallback(async () => {
    try {
      const [s, e, l] = await Promise.all([api.get('/admin/pickup/settings'), api.get('/admin/pickup/date-exceptions'), api.get('/admin/pickup/locations')]);
      setSettings(s.data);
      setExceptions(e.data || []);
      setStoreWindows(Object.fromEntries((l.data || []).map(x => [x.id, x.maxAdvanceDays])));
    } catch (err) { toast.error(err.message || 'Could not load dates'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const store = locations.find(l => l.id === scope);
  const windowDays = (scope && storeWindows[scope]) || settings?.maxAdvanceDays || 7;

  const days = useMemo(() => {
    if (!settings) return [];
    const first = addDays(settings.today, settings.minAdvanceDays);
    const last = addDays(settings.today, windowDays);
    return Array.from({ length: DAYS_SHOWN }, (_, i) => {
      const date = addDays(settings.today, i);
      const own = scope ? exceptions.find(x => x.date === date && x.locationId === scope) : null;
      const global = exceptions.find(x => x.date === date && !x.locationId);
      const exception = own || global;
      let state;
      if (date === settings.today) state = { tone: 'bg-gray-100 text-gray-400', label: 'Today · no pickups' };
      else if (date < first) state = { tone: 'bg-gray-100 text-gray-400', label: 'Too soon' };
      else if (exception) state = exception.isOpen ? { tone: 'bg-green-50 text-green-700 border-green-200', label: exception.reason || 'Opened' } : { tone: 'bg-red-50 text-red-700 border-red-200', label: exception.reason || 'Closed' };
      else if (!settings.workingDays.includes(weekdayOf(date))) state = { tone: 'bg-gray-50 text-gray-500', label: 'Closed day' };
      else state = { tone: 'bg-white text-gray-800', label: 'Open' };
      const beyond = date > last;
      return { date, state, beyond, own, global, editable: date > settings.today };
    });
  }, [settings, exceptions, scope, windowDays]);

  const listed = exceptions.filter(x => !scope || !x.locationId || x.locationId === scope);
  const remove = async (x) => {
    try {
      await api.delete(`/admin/pickup/date-exceptions/${x.id}`);
      toast.success('Removed');
      load();
    } catch (err) { toast.error(err.message || 'Could not remove'); }
  };

  if (!settings) return <p className="text-gray-400 text-center py-12">Loading…</p>;
  const lead = weekdayOf(settings.today);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2">
        {!isAdmin && <ReadOnlyNote />}
        <Card
          title="Pickup calendar"
          subtitle={`Customers can book up to ${windowDays} days ahead${store ? ` at ${store.name}` : ''}. ${isAdmin ? 'Click a date to close or open it.' : ''}`}
          actions={!isManager && (
            <select value={scope} onChange={(e) => setScope(e.target.value)} className="text-sm border rounded-lg px-2 py-1.5" aria-label="Store">
              <option value="">All stores</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
        >
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAYS.map(d => <div key={d} className="text-[11px] font-semibold text-gray-400 uppercase pb-1">{d}</div>)}
            {Array.from({ length: lead }, (_, i) => <div key={`lead-${i}`} />)}
            {days.map(d => (
              <button
                key={d.date}
                type="button"
                disabled={!isAdmin || !d.editable}
                onClick={() => setEditing({ date: d.date, existing: scope ? d.own : d.global })}
                className={`min-h-[64px] rounded-lg border p-1.5 text-left transition-shadow ${d.state.tone} ${d.beyond ? 'opacity-50' : ''} ${isAdmin && d.editable ? 'hover:shadow-md hover:border-primary' : 'cursor-default'}`}
                title={d.beyond ? 'Beyond the booking window' : d.state.label}
              >
                <span className="block text-sm font-semibold">{Number(d.date.slice(8))}</span>
                <span className="block text-[10px] leading-tight mt-0.5 line-clamp-2">{d.beyond ? 'Beyond window' : d.state.label}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border" />Open</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 border border-red-200" />Holiday / closed date</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-50 border border-green-200" />Opened specially</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100" />Not bookable</span>
          </div>
        </Card>
      </div>

      <Card title="Holidays & exceptions" subtitle="Upcoming dates that differ from the weekly schedule." className="h-fit">
        {listed.length === 0 ? <Empty>No upcoming exceptions.</Empty> : (
          <ul className="divide-y">
            {listed.map(x => (
              <li key={x.id} className="flex items-center gap-3 py-2.5">
                <span className={`w-2 h-8 rounded ${x.isOpen ? 'bg-green-400' : 'bg-red-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{prettyDay(x.date)} · {x.isOpen ? 'Open' : 'Closed'}</p>
                  <p className="text-xs text-gray-500 truncate">{x.reason || '—'} · {x.location?.name || 'All stores'}</p>
                </div>
                {isAdmin && <button onClick={() => remove(x)} className="p-1.5 text-gray-400 hover:text-red-500" aria-label="Remove exception"><HiOutlineTrash className="w-4 h-4" /></button>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && <ExceptionDialog date={editing.date} existing={editing.existing} locationId={scope} storeName={store?.name} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function ExceptionDialog({ date, existing, locationId, storeName, onClose, onSaved }) {
  const [isOpen, setIsOpen] = useState(existing ? existing.isOpen : false);
  const [reason, setReason] = useState(existing?.reason || '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/admin/pickup/date-exceptions', { date, locationId: locationId || null, isOpen, reason });
      toast.success(isOpen ? 'Date opened for pickups' : 'Date closed for pickups');
      onSaved();
    } catch (err) { toast.error(err.message || 'Could not save'); }
    finally { setBusy(false); }
  };
  const clear = async () => {
    setBusy(true);
    try {
      await api.delete(`/admin/pickup/date-exceptions/${existing.id}`);
      toast.success('Back to the weekly schedule');
      onSaved();
    } catch (err) { toast.error(err.message || 'Could not remove'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={prettyDay(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      subtitle={storeName ? `Only for ${storeName}` : 'For all stores (a store\'s own setting wins)'}
      onClose={onClose}
      footer={(
        <>
          {existing && <button onClick={clear} disabled={busy} className="mr-auto px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">Use weekly schedule</button>}
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton busy={busy} onClick={save}>Save</PrimaryButton>
        </>
      )}
    >
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setIsOpen(false)} className={`p-3 rounded-xl border text-sm text-left ${!isOpen ? 'border-red-300 bg-red-50 text-red-700' : 'text-gray-600'}`}>
          <b className="block">Closed</b>Holiday or blocked date
        </button>
        <button type="button" onClick={() => setIsOpen(true)} className={`p-3 rounded-xl border text-sm text-left ${isOpen ? 'border-green-300 bg-green-50 text-green-700' : 'text-gray-600'}`}>
          <b className="block">Open</b>Even if it's a closed weekday
        </button>
      </div>
      <Field label="Reason shown to customers" hint="e.g. Diwali holiday">
        <input value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder={isOpen ? 'Special opening' : 'Holiday'} />
      </Field>
      <p className="text-xs text-gray-500">Bookings already made for this date are not cancelled automatically.</p>
    </Modal>
  );
}
