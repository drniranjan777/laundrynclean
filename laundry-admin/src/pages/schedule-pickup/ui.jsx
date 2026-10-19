import { useEffect } from 'react';
import { HiX, HiOutlineLockClosed } from 'react-icons/hi';

// Shared building blocks for the Schedule Pickup admin tabs

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const inputClass = 'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:bg-gray-50 disabled:text-gray-500';

/** YYYY-MM-DD plus n days (calendar dates, no time zone shifts) */
export const addDays = (day, n) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const weekdayOf = (day) => new Date(`${day}T12:00:00Z`).getUTCDay();
export const prettyDay = (day, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => (day
  ? new Date(`${day}T12:00:00Z`).toLocaleDateString('en-IN', { ...opts, timeZone: 'UTC' })
  : '—');
/** "08:00" -> "8:00 AM" */
export const time12 = (t) => {
  if (!t) return '';
  const h = Number(t.slice(0, 2));
  return `${h % 12 === 0 ? 12 : h % 12}:${t.slice(3, 5)} ${h < 12 ? 'AM' : 'PM'}`;
};
export const daysText = (days = []) => {
  const set = [...days].map(Number).sort();
  if (set.length === 7) return 'Every day';
  if (set.join() === '1,2,3,4,5,6') return 'Mon – Sat';
  if (set.join() === '1,2,3,4,5') return 'Mon – Fri';
  return set.map(d => WEEKDAYS[d]).join(', ') || 'No days';
};

export function Card({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`bg-white rounded-xl shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 pt-4 pb-3 border-b">
          <div>
            {title && <h3 className="font-semibold text-gray-800">{title}</h3>}
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export const Field = ({ label, hint, children, className = '' }) => (
  <label className={`block ${className}`}>
    <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
  </label>
);

export function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-70' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-gray-300'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
      <span>
        <span className="block text-sm font-medium text-gray-800">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
    </label>
  );
}

/** Weekday chips */
export function DayPicker({ value = [], onChange, disabled }) {
  const set = new Set(value.map(Number));
  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEKDAYS.map((d, i) => {
        const on = set.has(i);
        return (
          <button
            key={d}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter(x => Number(x) !== i) : [...value, i].map(Number).sort())}
            className={`w-12 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${on ? 'bg-secondary text-white border-secondary' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'} disabled:cursor-default`}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({ title, subtitle, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[92vh] flex flex-col`}>
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

export const PrimaryButton = ({ children, busy, disabled, onClick, type = 'button' }) => (
  <button type={type} onClick={onClick} disabled={busy || disabled} className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary-dark disabled:opacity-50">
    {busy ? 'Saving…' : children}
  </button>
);
export const GhostButton = ({ children, onClick }) => (
  <button type="button" onClick={onClick} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">{children}</button>
);

export const ReadOnlyNote = () => (
  <p className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mb-4">
    <HiOutlineLockClosed className="w-4 h-4" /> Only admins can change these settings. You can view them for your store.
  </p>
);

export const Empty = ({ children }) => <p className="text-center text-sm text-gray-400 py-8">{children}</p>;
