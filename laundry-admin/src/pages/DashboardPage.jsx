import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import {
  HiOutlineShoppingBag, HiOutlineUsers, HiOutlineCash, HiOutlineTruck, HiOutlineDesktopComputer, HiOutlineDeviceMobile,
  HiOutlineCalendar, HiOutlineClock, HiChevronRight,
} from 'react-icons/hi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

/** Today's date in India time (YYYY-MM-DD), the day the Orders page's date filter uses */
const todayInIndia = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/** A dashboard figure that opens the list behind it */
function StatLink({ to, title, children, className = '' }) {
  return (
    <Link
      to={to}
      title={title}
      className={`group block bg-white rounded-xl shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
    >
      {children}
    </Link>
  );
}

const ViewHint = () => (
  <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-gray-400 group-hover:text-primary transition-colors">
    View <HiChevronRight className="w-3.5 h-3.5" />
  </span>
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ orders: 0, users: 0, revenue: 0, drivers: 0, week: [] });
  const [offlineStats, setOfflineStats] = useState({ totalOfflineOrders: 0, todayOfflineOrders: 0, offlineRevenue: 0, pendingPayments: 0, paymentBreakdown: {} });

  useEffect(() => {
    fetchStats();
    fetchOfflineStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/dashboard');
      if (res.success && res.data) setStats({ week: [], ...res.data });
    } catch (err) { /* figures stay at 0 */ }
  };

  const fetchOfflineStats = async () => {
    try {
      const res = await api.get('/admin/pos/stats');
      if (res.success && res.data) setOfflineStats(res.data);
    } catch (err) { /* ignore */ }
  };

  const onlineOrders = stats.orders - offlineStats.totalOfflineOrders;
  const onlineRevenue = (stats.revenue || 0) - (offlineStats.offlineRevenue || 0);
  const week = stats.week || [];
  // A bar click gives the bar's data (Recharts puts the day's entry in `payload`)
  const openDay = (type, bar) => {
    const day = bar?.payload?.date || bar?.date;
    if (day) navigate(`/orders?type=${type}&date=${day}`);
  };
  const weekTotal = week.reduce((n, d) => n + d.online + d.offline, 0);

  const mainCards = [
    { to: '/orders', title: 'Open all orders', label: 'Total Orders', value: stats.orders, icon: HiOutlineShoppingBag, tone: 'bg-blue-50 text-blue-600' },
    { to: '/orders?payment=paid', title: 'Open paid orders (revenue)', label: 'Total Revenue', value: `₹${(stats.revenue || 0).toLocaleString()}`, icon: HiOutlineCash, tone: 'bg-yellow-50 text-yellow-600' },
    { to: '/users', title: 'Open customers', label: 'Total Users', value: stats.users, icon: HiOutlineUsers, tone: 'bg-green-50 text-green-600' },
    { to: '/delivery-boys', title: 'Open delivery boys', label: 'Active Drivers', value: stats.drivers, icon: HiOutlineTruck, tone: 'bg-purple-50 text-purple-600' },
  ];

  const methods = [
    { key: 'cod', label: 'Cash', value: offlineStats.paymentBreakdown?.cash || 0 },
    { key: 'upi', label: 'UPI', value: offlineStats.paymentBreakdown?.upi || 0 },
    { key: 'card', label: 'Card', value: offlineStats.paymentBreakdown?.card || 0 },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {mainCards.map(c => (
          <StatLink key={c.label} to={c.to} title={c.title} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{c.label}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{c.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${c.tone}`}>
                <c.icon className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-2"><ViewHint /></div>
          </StatLink>
        ))}
      </div>

      {/* Online vs Offline Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatLink to="/orders?type=online" title="Open online orders" className="p-4 border-l-4 border-blue-400">
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-2 text-xs font-medium text-blue-600"><HiOutlineDeviceMobile className="w-4 h-4 text-blue-500" />ONLINE</span>
            <ViewHint />
          </div>
          <p className="text-xl font-bold">{onlineOrders > 0 ? onlineOrders : 0} orders</p>
          <p className="text-xs text-gray-400">₹{(onlineRevenue > 0 ? onlineRevenue : 0).toLocaleString()} revenue</p>
        </StatLink>
        <StatLink to="/orders?type=offline" title="Open store (POS) orders" className="p-4 border-l-4 border-orange-400">
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-2 text-xs font-medium text-orange-600"><HiOutlineDesktopComputer className="w-4 h-4 text-orange-500" />OFFLINE (POS)</span>
            <ViewHint />
          </div>
          <p className="text-xl font-bold">{offlineStats.totalOfflineOrders} orders</p>
          <p className="text-xs text-gray-400">₹{(offlineStats.offlineRevenue || 0).toLocaleString()} revenue</p>
        </StatLink>
        <StatLink to={`/orders?type=offline&date=${todayInIndia()}`} title="Open today's store orders" className="p-4 border-l-4 border-green-400">
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-2 text-xs font-medium text-green-600"><HiOutlineCalendar className="w-4 h-4" />TODAY (OFFLINE)</span>
            <ViewHint />
          </div>
          <p className="text-xl font-bold">{offlineStats.todayOfflineOrders}</p>
          <p className="text-xs text-gray-400">orders taken at counter</p>
        </StatLink>
        <StatLink to="/orders?type=offline&payment=pending" title="Open unpaid store orders" className="p-4 border-l-4 border-red-400">
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-2 text-xs font-medium text-red-600"><HiOutlineClock className="w-4 h-4" />PENDING PAYMENTS</span>
            <ViewHint />
          </div>
          <p className="text-xl font-bold">{offlineStats.pendingPayments}</p>
          <p className="text-xs text-gray-400">pay later orders</p>
        </StatLink>
      </div>

      {/* Payment Breakdown (store orders) */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {methods.map(m => (
          <StatLink key={m.key} to={`/orders?type=offline&method=${m.key}`} title={`Open store orders paid by ${m.label}`} className="p-4 text-center">
            <p className="text-xs text-gray-500">{m.label}</p>
            <p className="text-lg font-bold text-gray-800">{m.value}</p>
            <ViewHint />
          </StatLink>
        ))}
      </div>

      {/* Chart: real orders per day; a bar opens that day's orders */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h3 className="text-lg font-semibold text-gray-700">Orders This Week (Online vs Offline)</h3>
          <p className="text-xs text-gray-400">{weekTotal} order{weekTotal === 1 ? '' : 's'} in the last 7 days · click a bar to open that day</p>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={week}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip cursor={{ fill: 'rgba(0,133,122,0.06)' }} />
              <Legend />
              <Bar
                dataKey="online"
                fill="#007BCA"
                radius={[4, 4, 0, 0]}
                name="Online"
                cursor="pointer"
                onClick={(d) => openDay('online', d)}
              />
              <Bar
                dataKey="offline"
                fill="#FB923C"
                radius={[4, 4, 0, 0]}
                name="Offline"
                cursor="pointer"
                onClick={(d) => openDay('offline', d)}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
