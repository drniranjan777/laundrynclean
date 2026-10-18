import { useState, useEffect } from 'react';
import api from '../api/axios';
import { HiOutlineShoppingBag, HiOutlineUsers, HiOutlineCash, HiOutlineTruck, HiOutlineDesktopComputer, HiOutlineDeviceMobile } from 'react-icons/hi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockChartData = [
  { name: 'Mon', online: 8, offline: 4 },
  { name: 'Tue', online: 12, offline: 7 },
  { name: 'Wed', online: 5, offline: 3 },
  { name: 'Thu', online: 10, offline: 5 },
  { name: 'Fri', online: 15, offline: 7 },
  { name: 'Sat', online: 18, offline: 10 },
  { name: 'Sun', online: 3, offline: 2 },
];

export default function DashboardPage() {
  const [stats, setStats] = useState({ orders: 0, users: 0, revenue: 0, drivers: 0 });
  const [offlineStats, setOfflineStats] = useState({ totalOfflineOrders: 0, todayOfflineOrders: 0, offlineRevenue: 0, pendingPayments: 0, paymentBreakdown: {} });

  useEffect(() => {
    fetchStats();
    fetchOfflineStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/dashboard');
      if (res.success && res.data) setStats(res.data);
    } catch (err) {
      setStats({ orders: 0, users: 1, revenue: 0, drivers: 0 });
    }
  };

  const fetchOfflineStats = async () => {
    try {
      const res = await api.get('/admin/pos/stats');
      if (res.success && res.data) setOfflineStats(res.data);
    } catch (err) { /* ignore */ }
  };

  const onlineOrders = stats.orders - offlineStats.totalOfflineOrders;
  const onlineRevenue = (stats.revenue || 0) - (offlineStats.offlineRevenue || 0);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats.orders}</p>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
              <HiOutlineShoppingBag className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">₹{(stats.revenue || 0).toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-yellow-50 text-yellow-600">
              <HiOutlineCash className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Users</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats.users}</p>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-green-50 text-green-600">
              <HiOutlineUsers className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Drivers</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats.drivers}</p>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-purple-50 text-purple-600">
              <HiOutlineTruck className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Online vs Offline Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-400">
          <div className="flex items-center gap-2 mb-1">
            <HiOutlineDeviceMobile className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-blue-600">ONLINE</span>
          </div>
          <p className="text-xl font-bold">{onlineOrders > 0 ? onlineOrders : 0} orders</p>
          <p className="text-xs text-gray-400">₹{(onlineRevenue > 0 ? onlineRevenue : 0).toLocaleString()} revenue</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-orange-400">
          <div className="flex items-center gap-2 mb-1">
            <HiOutlineDesktopComputer className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-medium text-orange-600">OFFLINE (POS)</span>
          </div>
          <p className="text-xl font-bold">{offlineStats.totalOfflineOrders} orders</p>
          <p className="text-xs text-gray-400">₹{(offlineStats.offlineRevenue || 0).toLocaleString()} revenue</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-400">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-green-600">TODAY (OFFLINE)</span>
          </div>
          <p className="text-xl font-bold">{offlineStats.todayOfflineOrders}</p>
          <p className="text-xs text-gray-400">orders taken at counter</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-red-400">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-red-600">PENDING PAYMENTS</span>
          </div>
          <p className="text-xl font-bold">{offlineStats.pendingPayments}</p>
          <p className="text-xs text-gray-400">pay later orders</p>
        </div>
      </div>

      {/* Payment Breakdown */}
      {offlineStats.paymentBreakdown && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-xs text-gray-500">Cash</p>
            <p className="text-lg font-bold text-gray-800">{offlineStats.paymentBreakdown.cash || 0}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-xs text-gray-500">UPI</p>
            <p className="text-lg font-bold text-gray-800">{offlineStats.paymentBreakdown.upi || 0}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-xs text-gray-500">Card</p>
            <p className="text-lg font-bold text-gray-800">{offlineStats.paymentBreakdown.card || 0}</p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Orders This Week (Online vs Offline)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="online" fill="#007BCA" radius={[4, 4, 0, 0]} name="Online" />
              <Bar dataKey="offline" fill="#FB923C" radius={[4, 4, 0, 0]} name="Offline" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
