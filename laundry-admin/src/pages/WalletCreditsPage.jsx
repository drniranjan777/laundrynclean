import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { HiOutlineGift, HiOutlineUsers, HiOutlineUserAdd, HiOutlineCalendar, HiOutlineMinusCircle } from 'react-icons/hi';

const targetOptions = [
  { value: 'individual', label: 'Credit User', icon: HiOutlineUserAdd, desc: 'Credit specific user' },
  { value: 'debit', label: 'Debit User', icon: HiOutlineMinusCircle, desc: 'Deduct balance (mistake reversal)' },
  { value: 'all', label: 'All Customers', icon: HiOutlineUsers, desc: 'Festival/general offer for everyone' },
  { value: 'new_users', label: 'New Users', icon: HiOutlineGift, desc: 'Users who joined recently' },
  { value: 'by_date', label: 'By Joining Date', icon: HiOutlineCalendar, desc: 'Users registered in date range' },
];

export default function WalletCreditsPage() {
  const [target, setTarget] = useState('individual');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [userId, setUserId] = useState('');
  const [daysJoined, setDaysJoined] = useState('7');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);

  // Users list for individual
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');

  // Credit history
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/admin/wallet/credit-history');
      setHistory(res.data?.transactions || []);
    } catch (err) { /* ignore */ }
    finally { setHistoryLoading(false); }
  };

  const searchUsers = async () => {
    if (!userSearch || userSearch.length < 2) return;
    try {
      const res = await api.get('/admin/users', { params: { search: userSearch, limit: 10 } });
      setUsers(res.data?.users || []);
    } catch (err) { /* ignore */ }
  };

  const handleCredit = async () => {
    if (!amount || parseFloat(amount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (!reason) { toast.error('Reason is required'); return; }

    setLoading(true);
    try {
      if (target === 'individual') {
        if (!userId) { toast.error('Select a user'); setLoading(false); return; }
        await api.post('/admin/wallet/credit-user', { userId, amount: parseFloat(amount), reason });
        toast.success('Wallet credited to user');
      } else if (target === 'debit') {
        if (!userId) { toast.error('Select a user'); setLoading(false); return; }
        await api.post('/admin/wallet/debit-user', { userId, amount: parseFloat(amount), reason });
        toast.success('Wallet debited from user');
      } else {
        const payload = { amount: parseFloat(amount), reason, target };
        if (target === 'new_users') payload.daysJoined = parseInt(daysJoined) || 7;
        if (target === 'by_date') { payload.fromDate = fromDate; payload.toDate = toDate; }
        const res = await api.post('/admin/wallet/credit-bulk', payload);
        toast.success(res.message || 'Bulk credit successful');
      }
      // Reset
      setAmount('');
      setReason('');
      setUserId('');
      fetchHistory();
    } catch (err) {
      toast.error(err.message || 'Failed to credit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Wallet Credits & Offers</h2>

      {/* Target Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {targetOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTarget(opt.value)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              target === opt.value ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <opt.icon className={`w-6 h-6 mb-2 ${target === opt.value ? 'text-primary' : 'text-gray-400'}`} />
            <p className="font-medium text-sm">{opt.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
          </button>
        ))}
      </div>

      {/* Credit Form */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h3 className="font-semibold mb-4">
          {target === 'individual' ? 'Credit Individual User' :
           target === 'debit' ? 'Debit User (Reverse Mistake)' :
           target === 'all' ? 'Credit All Customers' :
           target === 'new_users' ? 'Credit New Users' : 'Credit by Joining Date'}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Individual user search */}
          {(target === 'individual' || target === 'debit') && (
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Search & Select User</label>
              <div className="flex gap-2">
                <input
                  placeholder="Type name or phone and press Search..."
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); if (userId) setUserId(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                />
                <button onClick={searchUsers} className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">Search</button>
              </div>
              {/* Search results - user MUST click one to select */}
              {users.length > 0 && !userId && (
                <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto bg-white shadow-sm">
                  <p className="px-3 py-1 text-xs text-gray-400 border-b bg-gray-50">Click to select a user:</p>
                  {users.map(u => (
                    <button
                      key={u.id}
                      onClick={() => { setUserId(u.id); setUsers([]); setUserSearch(`${u.name} (${u.phone})`); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primary/5 border-b last:border-0"
                    >
                      <span className="font-medium">{u.name || 'Unnamed'}</span>
                      <span className="text-gray-400 ml-2">{u.phone}</span>
                      <span className="text-gray-300 ml-2">{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
              {userId && <p className="text-xs text-green-600 mt-2 px-3 py-1.5 bg-green-50 rounded-lg inline-block">✓ User selected — ready to {target === 'debit' ? 'debit' : 'credit'}</p>}
              {!userId && userSearch && users.length === 0 && <p className="text-xs text-red-500 mt-1">No results. Try a different search or click Search button.</p>}
            </div>
          )}

          {/* New users - days */}
          {target === 'new_users' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Joined within last (days)</label>
              <input type="number" value={daysJoined} onChange={(e) => setDaysJoined(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          )}

          {/* By date range */}
          {target === 'by_date' && (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">From Date</label>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">To Date</label>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </>
          )}

          {/* Amount */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Amount (₹)</label>
            <input type="number" placeholder="e.g. 100" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>

          {/* Reason */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Reason / Offer Name</label>
            <input placeholder="e.g. Diwali Bonus, Welcome Gift..." value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
        </div>

        <button
          onClick={handleCredit}
          disabled={loading}
          className={`mt-5 px-6 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${target === 'debit' ? 'bg-red-500 hover:bg-red-600' : 'bg-secondary hover:bg-secondary-dark'}`}
        >
          {loading ? 'Processing...' : target === 'debit' ? `Debit ₹${amount || '0'} from User` : `Credit ₹${amount || '0'} ${target === 'individual' ? 'to User' : target === 'all' ? 'to All Customers' : target === 'new_users' ? 'to New Users' : 'to Selected Users'}`}
        </button>
      </div>

      {/* Credit History */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold">Credit History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Phone</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Reason</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {historyLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No credits given yet</td></tr>
              ) : (
                history.map((txn) => (
                  <tr key={txn.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{txn.userName}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500">{txn.userPhone}</td>
                    <td className={`px-4 py-3 font-medium ${txn.type === 'debit' ? 'text-red-500' : 'text-green-600'}`}>
                      {txn.type === 'debit' ? `-₹${txn.amount}` : `+₹${txn.amount}`}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{txn.description?.replace('Admin Credit: ', '').replace('Admin Debit: ', '')}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400">{new Date(txn.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
