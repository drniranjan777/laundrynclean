import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { Card, Empty } from './ui';
import { formatDateTime } from '../../utils/orderStatus';

const ACTIONS = {
  'settings.update': 'Changed Schedule Pickup settings',
  'slot.create': 'Added a time slot',
  'slot.update': 'Edited a time slot',
  'slot.delete': 'Deleted a time slot',
  'slot_override.create': 'Set capacity for a date',
  'slot_override.update': 'Changed capacity for a date',
  'slot_override.delete': 'Removed date capacity',
  'date_exception.create': 'Added a holiday / date exception',
  'date_exception.update': 'Changed a date exception',
  'date_exception.delete': 'Removed a date exception',
  'charge_rule.create': 'Added a charge rule',
  'charge_rule.update': 'Edited a charge rule',
  'charge_rule.delete': 'Deleted a charge rule',
  'location.pickup_update': 'Changed a store\'s pickup settings',
  'location.slot_capacity': 'Changed a store\'s slot capacity',
  'booking.bill': 'Billed a bulk pickup',
};
const ENTITIES = [
  ['', 'Everything'], ['pickup_settings', 'Settings'], ['time_slot', 'Time slots'], ['slot_override', 'Date capacity'],
  ['date_exception', 'Holidays'], ['delivery_charge_rule', 'Charge rules'], ['location', 'Stores'], ['booking', 'Bills'],
];
const HIDDEN = new Set(['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at', 'updatedBy', 'createdBy']);

/** Field-by-field changes between the before and after snapshots */
const changes = (before, after) => {
  if (!before && after) return Object.entries(after).filter(([k, v]) => !HIDDEN.has(k) && v !== null && v !== '').map(([k, v]) => ({ k, to: v }));
  if (before && !after) return [{ k: 'removed', to: before.label || before.name || before.date || '' }];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys].filter(k => !HIDDEN.has(k) && JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k])).map(k => ({ k, from: before?.[k], to: after?.[k] }));
};
const show = (v) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** Who changed what in Schedule Pickup, newest first */
export default function ActivityTab() {
  const [entity, setEntity] = useState('');
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/pickup/audit-logs', { params: { entity: entity || undefined, page, limit: 30 } });
      setData(res.data);
    } catch (err) { toast.error(err.message || 'Could not load the activity log'); }
  }, [entity, page]);
  useEffect(() => { load(); }, [load]);

  return (
    <Card
      title="Activity log"
      subtitle="Every configuration change and bill, with who made it and the values before and after."
      actions={(
        <select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} className="text-sm border rounded-lg px-2 py-1.5" aria-label="Filter">
          {ENTITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      )}
    >
      {!data ? <p className="text-gray-400 text-center py-8">Loading…</p> : data.logs.length === 0 ? <Empty>No activity yet.</Empty> : (
        <>
          <ul className="divide-y">
            {data.logs.map(l => {
              const diff = changes(l.before, l.after).slice(0, 8);
              return (
                <li key={l.id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800">{ACTIONS[l.action] || l.action}</p>
                    <p className="text-[11px] text-gray-400">{formatDateTime(l.created_at || l.createdAt)}</p>
                  </div>
                  <p className="text-xs text-gray-500">{l.actor ? `${l.actor.name} (${l.actor.role})` : 'System'}</p>
                  {diff.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {diff.map(d => (
                        <span key={d.k} className="text-[11px] bg-gray-50 border rounded px-1.5 py-0.5 text-gray-600 max-w-full truncate">
                          {d.k}: {'from' in d ? <><s className="text-gray-400">{show(d.from)}</s> → </> : null}<b>{show(d.to)}</b>
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-40">Newer</button>
              <span className="text-gray-500">Page {data.page} of {data.totalPages}</span>
              <button disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-40">Older</button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
