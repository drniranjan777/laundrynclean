import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { HiOutlineEye, HiOutlineBan, HiOutlineCheckCircle, HiX } from 'react-icons/hi';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // User detail modal
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => { fetchUsers(); }, [page, roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (roleFilter) params.role = roleFilter;
      if (search) params.search = search;
      const res = await api.get('/admin/users', { params });
      setUsers(res.data?.users || []);
      setTotalPages(res.data?.totalPages || 1);
      setTotal(res.data?.total || 0);
    } catch (err) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => { setPage(1); fetchUsers(); };

  const viewUserDetail = async (userId) => {
    setSelectedUser(userId);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/admin/users/${userId}`);
      setUserDetail(res.data);
    } catch (err) {
      toast.error('Failed to load user details');
      setSelectedUser(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const toggleBlock = async (userId) => {
    try {
      const res = await api.patch(`/admin/users/${userId}/block`);
      toast.success(res.message);
      fetchUsers();
      if (userDetail?.user?.id === userId) {
        setUserDetail({ ...userDetail, user: { ...userDetail.user, isActive: res.data.isActive } });
      }
    } catch (err) {
      toast.error(err.message || 'Failed');
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Users</h2>
          <p className="text-sm text-gray-500">{total} registered users</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All Roles</option>
          <option value="customer">Customers</option>
          <option value="admin">Admins</option>
        </select>
        <div className="flex gap-2 flex-1">
          <input
            type="text"
            placeholder="Search by name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-4 py-2 border rounded-lg text-sm"
          />
          <button onClick={handleSearch} className="px-4 py-2 bg-secondary text-white rounded-lg text-sm">Search</button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Role</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Last Login</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No users found</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{u.name || '—'}</td>
                    <td className="px-4 py-3">{u.phone}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500">{u.email || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        u.role === 'admin' ? 'bg-purple-50 text-purple-600' :
                        u.role === 'driver' ? 'bg-blue-50 text-blue-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <span className="px-2 py-1 bg-green-50 text-green-600 rounded-full text-xs">Active</span>
                      ) : (
                        <span className="px-2 py-1 bg-red-50 text-red-500 rounded-full text-xs">Blocked</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => viewUserDetail(u.id)} className="p-1 text-gray-400 hover:text-blue-500" title="View Details">
                          <HiOutlineEye className="w-4 h-4" />
                        </button>
                        {u.role !== 'admin' && (
                          <button onClick={() => toggleBlock(u.id)} className={`p-1 ${u.isActive ? 'text-gray-400 hover:text-red-500' : 'text-gray-400 hover:text-green-500'}`} title={u.isActive ? 'Block' : 'Unblock'}>
                            {u.isActive ? <HiOutlineBan className="w-4 h-4" /> : <HiOutlineCheckCircle className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Previous</button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Next</button>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl">
              <h3 className="font-bold text-lg">User Details</h3>
              <button onClick={() => setSelectedUser(null)} className="p-1 hover:bg-gray-100 rounded"><HiX className="w-5 h-5" /></button>
            </div>

            {loadingDetail ? (
              <p className="p-8 text-center text-gray-400">Loading...</p>
            ) : userDetail ? (
              <div className="p-5 space-y-5">
                {/* Profile */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-secondary">
                    {(userDetail.user.name || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">{userDetail.user.name || 'Unnamed'}</h4>
                    <p className="text-sm text-gray-500">{userDetail.user.phone} • {userDetail.user.email || 'No email'}</p>
                    <div className="flex gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${userDetail.user.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        {userDetail.user.isActive ? 'Active' : 'Blocked'}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{userDetail.user.role}</span>
                      {userDetail.user.isVerified && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs">Verified</span>}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-gray-800">{userDetail.stats.ordersCount}</p>
                    <p className="text-xs text-gray-500">Orders</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-gray-800">₹{userDetail.stats.totalSpent}</p>
                    <p className="text-xs text-gray-500">Spent</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-green-600">₹{userDetail.stats.walletBalance}</p>
                    <p className="text-xs text-gray-500">Wallet</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-gray-800">{userDetail.stats.reviewsCount}</p>
                    <p className="text-xs text-gray-500">Reviews</p>
                  </div>
                </div>

                {/* Addresses */}
                {userDetail.addresses?.length > 0 && (
                  <div>
                    <h5 className="font-semibold text-sm text-gray-700 mb-2">Addresses ({userDetail.addresses.length})</h5>
                    <div className="space-y-2">
                      {userDetail.addresses.map(a => (
                        <div key={a.id} className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                          {a.isDefault && <span className="text-primary font-medium mr-1">★</span>}
                          {a.fullName} — {a.addressLine}, {a.city} {a.pincode}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Orders */}
                {userDetail.recentOrders?.length > 0 && (
                  <div>
                    <h5 className="font-semibold text-sm text-gray-700 mb-2">Recent Orders</h5>
                    <div className="space-y-2">
                      {userDetail.recentOrders.map(o => (
                        <div key={o.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg p-2">
                          <span className="font-mono font-medium">{o.orderNumber}</span>
                          <span>₹{o.total}</span>
                          <span className={`px-2 py-0.5 rounded-full ${o.status === 'delivered' ? 'bg-green-50 text-green-600' : o.status === 'cancelled' ? 'bg-red-50 text-red-500' : 'bg-yellow-50 text-yellow-600'}`}>
                            {o.status?.replace(/_/g, ' ')}
                          </span>
                          <span className="text-gray-400">{o.pickupDate}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Last login */}
                <p className="text-xs text-gray-400">
                  Last login: {userDetail.user.lastLoginAt ? new Date(userDetail.user.lastLoginAt).toLocaleString() : 'Never'}
                </p>

                {/* Block/Unblock button */}
                {userDetail.user.role !== 'admin' && (
                  <button
                    onClick={() => toggleBlock(userDetail.user.id)}
                    className={`w-full py-2 rounded-lg text-sm font-medium ${
                      userDetail.user.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {userDetail.user.isActive ? 'Block This User' : 'Unblock This User'}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
