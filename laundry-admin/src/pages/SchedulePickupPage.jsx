import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  HiOutlineClipboardList, HiOutlineCog, HiOutlineCalendar, HiOutlineClock, HiOutlineCurrencyRupee, HiOutlineOfficeBuilding,
  HiOutlineDocumentSearch, HiOutlineIdentification,
} from 'react-icons/hi';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import BookingsTab from './schedule-pickup/BookingsTab';
import SettingsTab from './schedule-pickup/SettingsTab';
import DatesTab from './schedule-pickup/DatesTab';
import SlotsTab from './schedule-pickup/SlotsTab';
import ChargesTab from './schedule-pickup/ChargesTab';
import StoresTab from './schedule-pickup/StoresTab';
import ActivityTab from './schedule-pickup/ActivityTab';

const TABS = [
  { key: 'bookings', label: 'Bookings', icon: HiOutlineClipboardList, Component: BookingsTab },
  { key: 'settings', label: 'Settings', icon: HiOutlineCog, Component: SettingsTab },
  { key: 'dates', label: 'Dates & holidays', icon: HiOutlineCalendar, Component: DatesTab },
  { key: 'slots', label: 'Time slots', icon: HiOutlineClock, Component: SlotsTab },
  { key: 'charges', label: 'Delivery charges', icon: HiOutlineCurrencyRupee, Component: ChargesTab },
  { key: 'stores', label: 'Stores', icon: HiOutlineOfficeBuilding, Component: StoresTab },
  { key: 'activity', label: 'Activity log', icon: HiOutlineDocumentSearch, Component: ActivityTab, adminOnly: true },
];

/**
 * Schedule Pickup: the bulk-order bookings customers make in the app, and everything that decides what they can
 * book (switches, booking window, working days and holidays, time slots and capacity, charges, per-store rules).
 * Branch managers see their store's bookings and can bill them; the configuration is read-only for them.
 */
export default function SchedulePickupPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const tabs = TABS.filter(t => isAdmin || !t.adminOnly);
  const active = tabs.find(t => t.key === searchParams.get('tab')) || tabs[0];
  const [summary, setSummary] = useState(null);

  const loadSummary = async () => {
    try {
      const res = await api.get('/admin/pickup/summary');
      setSummary(res.data);
    } catch { setSummary(null); }
  };
  useEffect(() => { loadSummary(); }, []);

  const open = (key) => {
    const next = new URLSearchParams();
    next.set('tab', key);
    setSearchParams(next);
  };

  const next7 = summary ? summary.upcoming.filter(u => u.bookingType === 'bulk_pickup' && u.date <= addDaysIso(summary.today, 7)).reduce((n, u) => n + u.count, 0) : null;
  const awaitingBill = summary ? (summary.byStatus.picked_up || 0) + (summary.byStatus.in_process || 0) : null;

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold text-gray-800">Schedule Pickup</h2>
            {summary && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${summary.enabled && summary.bulkEnabled ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {summary.enabled && summary.bulkEnabled ? 'Taking bookings' : 'Bookings paused'}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">Bulk-order pickups booked in the customer app, and the rules that decide which dates and slots customers can choose.</p>
        </div>
        <Link to="/delivery-boys" className="self-start lg:self-auto flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white rounded-lg shadow-sm hover:bg-gray-50">
          <HiOutlineIdentification className="w-4 h-4" /> Pickup partners
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Kpi label="Waiting for a partner" value={summary?.unassigned} tone="text-amber-600" onClick={() => open('bookings')} />
        <Kpi label="Pickups in the next 7 days" value={next7} tone="text-secondary" onClick={() => open('bookings')} />
        <Kpi label="Picked up, to be billed / processing" value={awaitingBill} tone="text-blue-600" onClick={() => open('bookings')} />
        <Kpi label="Delivered bulk orders" value={summary ? (summary.byStatus.delivered || 0) + (summary.byStatus.collected || 0) : null} tone="text-green-600" onClick={() => open('bookings')} />
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 mb-4 border-b" role="tablist">
        {tabs.map(t => {
          const on = t.key === active.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => open(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${on ? 'border-primary text-secondary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          );
        })}
      </div>

      <active.Component isAdmin={isAdmin} onChanged={loadSummary} />
    </div>
  );
}

const addDaysIso = (day, n) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function Kpi({ label, value, tone, onClick }) {
  return (
    <button onClick={onClick} className="text-left bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
      <p className={`text-2xl font-bold ${tone}`}>{value ?? '·'}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </button>
  );
}
