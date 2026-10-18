import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { HiPlus, HiPencil, HiTrash, HiX } from 'react-icons/hi';

export default function WalletPackagesPage() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', payAmount: '', creditAmount: '', description: '' });

  useEffect(() => { fetchPackages(); }, []);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const res = await api.get('/wallet/packages');
      setPackages(res.data || []);
    } catch (err) {
      toast.error('Failed to fetch packages');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ name: '', payAmount: '', creditAmount: '', description: '' });
    setEditId(null);
    setShowForm(false);
  };

  const bonus = () => {
    const pay = parseFloat(form.payAmount) || 0;
    const credit = parseFloat(form.creditAmount) || 0;
    return credit - pay;
  };

  const handleSave = async () => {
    if (!form.name || !form.payAmount || !form.creditAmount) { toast.error('Fill all required fields'); return; }
    if (bonus() < 0) { toast.error('Credit amount must be >= pay amount'); return; }
    try {
      const payload = { name: form.name, payAmount: parseFloat(form.payAmount), creditAmount: parseFloat(form.creditAmount), description: form.description };
      if (editId) {
        await api.put(`/admin/packages/${editId}`, payload);
        toast.success('Package updated');
      } else {
        await api.post('/admin/packages', payload);
        toast.success('Package created');
      }
      resetForm();
      fetchPackages();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const handleEdit = (pkg) => {
    setForm({ name: pkg.name, payAmount: pkg.payAmount, creditAmount: pkg.creditAmount, description: pkg.description || '' });
    setEditId(pkg.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this package?')) return;
    try {
      await api.delete(`/admin/packages/${id}`);
      toast.success('Package deleted');
      fetchPackages();
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Wallet Packages</h2>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
          {showForm ? <HiX className="w-4 h-4" /> : <HiPlus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Package'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <h3 className="font-semibold mb-4">{editId ? 'Edit Package' : 'New Package'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <input placeholder="Package Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Pay Amount (₹)" type="number" value={form.payAmount} onChange={(e) => setForm({ ...form, payAmount: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Credit Amount (₹)" type="number" value={form.creditAmount} onChange={(e) => setForm({ ...form, creditAmount: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <div className="px-3 py-2 border rounded-lg text-sm bg-gray-50 flex items-center">
              Bonus: <span className={`ml-1 font-medium ${bonus() >= 0 ? 'text-green-600' : 'text-red-500'}`}>₹{bonus()}</span>
            </div>
          </div>
          <input placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full mt-3 px-3 py-2 border rounded-lg text-sm" />
          <button onClick={handleSave} className="mt-4 px-4 py-2 bg-secondary text-white rounded-lg text-sm hover:bg-secondary-dark">
            {editId ? 'Update' : 'Save'} Package
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-center py-8">Loading...</p>
      ) : packages.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No packages found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {packages.map((pkg) => (
            <div key={pkg.id} className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-primary relative">
              <div className="absolute top-3 right-3 flex gap-1">
                <button onClick={() => handleEdit(pkg)} className="p-1 text-gray-400 hover:text-blue-500"><HiPencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(pkg.id)} className="p-1 text-gray-400 hover:text-red-500"><HiTrash className="w-4 h-4" /></button>
              </div>
              <h3 className="font-semibold text-gray-800">{pkg.name}</h3>
              <div className="mt-3 space-y-1 text-sm">
                <p className="text-gray-500">Pay: <span className="font-medium text-gray-800">₹{pkg.payAmount}</span></p>
                <p className="text-gray-500">Get: <span className="font-medium text-green-600">₹{pkg.creditAmount}</span></p>
                <p className="text-gray-500">Bonus: <span className="font-medium text-primary">₹{pkg.bonusAmount}</span></p>
              </div>
              <p className="text-xs text-gray-400 mt-2">{pkg.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
