import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { Card, Field, Toggle, DayPicker, PrimaryButton, ReadOnlyNote, inputClass, addDays, prettyDay } from './ui';

const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York'];

/** Switches, booking window, business timezone, working days, and the text customers read before booking */
export default function SettingsTab({ isAdmin, onChanged }) {
  const [form, setForm] = useState(null);
  const [today, setToday] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/admin/pickup/settings');
      const s = res.data;
      setToday(s.today);
      setForm({
        enabled: s.enabled, bulkEnabled: s.bulkEnabled, minAdvanceDays: String(s.minAdvanceDays), maxAdvanceDays: String(s.maxAdvanceDays),
        timezone: s.timezone, workingDays: s.workingDays || [], instructions: s.instructions || '', policies: s.policies || '',
      });
    } catch (err) { toast.error(err.message || 'Could not load the settings'); }
  };
  useEffect(() => { load(); }, []);

  if (!form) return <p className="text-gray-400 text-center py-12">Loading…</p>;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const min = Number(form.minAdvanceDays) || 0;
  const max = Number(form.maxAdvanceDays) || 0;
  const valid = Number.isInteger(min) && min >= 1 && min <= 30 && Number.isInteger(max) && max >= 1 && max <= 90 && max >= min && form.workingDays.length > 0;

  const save = async () => {
    if (!valid) { toast.error('Check the booking window and working days'); return; }
    setSaving(true);
    try {
      await api.put('/admin/pickup/settings', { ...form, minAdvanceDays: min, maxAdvanceDays: max });
      toast.success('Schedule Pickup settings saved');
      await load();
      onChanged?.();
    } catch (err) { toast.error(err.message || 'Could not save'); }
    finally { setSaving(false); }
  };

  const ro = !isAdmin;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        {ro && <ReadOnlyNote />}
        <Card title="Availability" subtitle="Turn customer bookings on or off. Existing bookings are not affected.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} disabled={ro} label="Schedule Pickup" hint="Shows the Book Pickup card in the customer app and accepts bookings." />
            <Toggle checked={form.bulkEnabled} onChange={(v) => set('bulkEnabled', v)} disabled={ro} label="Bulk order bookings" hint="Bulk pickups (counted and billed at the store after pickup)." />
          </div>
        </Card>

        <Card title="Booking window" subtitle="Dates are counted in the business timezone. Same-day pickup is never offered.">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Earliest pickup (days ahead)" hint="1 = tomorrow">
              <input type="number" min={1} max={30} value={form.minAdvanceDays} disabled={ro} onChange={(e) => set('minAdvanceDays', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Book up to (days ahead)" hint="Stores can have a shorter window">
              <input type="number" min={1} max={90} value={form.maxAdvanceDays} disabled={ro} onChange={(e) => set('maxAdvanceDays', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Business timezone">
              <select value={form.timezone} disabled={ro} onChange={(e) => set('timezone', e.target.value)} className={inputClass}>
                {[...new Set([form.timezone, ...TIMEZONES])].map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-5">
            <span className="block text-xs font-medium text-gray-600 mb-2">Working days</span>
            <DayPicker value={form.workingDays} onChange={(v) => set('workingDays', v)} disabled={ro} />
            <p className="text-[11px] text-gray-400 mt-1.5">Closed days can still be opened for a single date under Dates &amp; holidays.</p>
          </div>
          {!valid && <p className="mt-3 text-sm text-red-600">Earliest must be 1–30 days, the window 1–90 days and not shorter than the earliest day, with at least one working day.</p>}
        </Card>

        <Card title="Customer instructions & policies" subtitle="Shown on the pickup review screen in the app.">
          <div className="space-y-4">
            <Field label="Instructions" hint="Short note, e.g. how to keep the clothes ready.">
              <textarea rows={3} maxLength={2000} value={form.instructions} disabled={ro} onChange={(e) => set('instructions', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Policies" hint="One rule per line; each line becomes a bullet in the app.">
              <textarea rows={6} maxLength={4000} value={form.policies} disabled={ro} onChange={(e) => set('policies', e.target.value)} className={inputClass} />
            </Field>
          </div>
        </Card>
        {!ro && <PrimaryButton busy={saving} disabled={!valid} onClick={save}>Save settings</PrimaryButton>}
      </div>

      <Card title="What customers see" subtitle="With these settings (before holidays and store rules)." className="h-fit">
        {today && valid ? (
          <ul className="text-sm text-gray-700 space-y-2">
            <li>Today is <b>{prettyDay(today)}</b>. Same-day pickup is not offered.</li>
            <li>Earliest pickup: <b>{prettyDay(addDays(today, min))}</b></li>
            <li>Latest pickup: <b>{prettyDay(addDays(today, max))}</b></li>
            <li>{form.enabled && form.bulkEnabled ? <span className="text-green-700">The Book Pickup card is shown in the app.</span> : <span className="text-red-600">Bookings are paused; the app hides Book Pickup.</span>}</li>
          </ul>
        ) : <p className="text-sm text-gray-400">Fix the highlighted fields to see the preview.</p>}
      </Card>
    </div>
  );
}
