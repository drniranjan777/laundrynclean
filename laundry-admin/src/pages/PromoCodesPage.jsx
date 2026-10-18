import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { HiPlus, HiPencil, HiTrash, HiX } from 'react-icons/hi';

export default function PromoCodesPage() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    code: '', title: '', description: '', discountType: 'percentage', discountValue: '',
    maxDiscount: '', minOrderAmount: '', validDays: '30', usageLimit: '', usagePerUser: '1', isNewUserOnly: false
  });

  useEffect(() => { fetchCodes(); }, []);

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/promocodes');
      setCodes(res.data || []);
    } catch (err) {
      toast.error('Failed to fetch promo codes');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ code: '', title: '', description: '', discountType: 'percentage', discountValue: '', maxDiscount: '', minOrderAmount: '', validDays: '30', usageLimit: '', usagePerUser: '1', isNewUserOnly: false });
    setEditId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.code || !form.title || !form.discountValue) { toast.error('Code, title, and discount are required'); return; }
    try {
      const payload = { ...form, discountValue: parseFloat(form.discountValue), maxDiscount: form.maxDiscount ? parseFloat(form.maxDiscount) : null, minOrderAmount: parseFloat(form.minOrderAmount) || 0, usageLimit: form.usageLimit ? parseInt(form.usageLimit) : null, usagePerUser: parseInt(form.usagePerUser) || 1, isNewUserOnly: form.isNewUserOnly };
      if (editId) {
        await api.put(`/admin/promos/${editId}`, payload);
        toast.success('Promo code updated');
      } else {
        await api.post('/admin/promos', payload);
        toast.success('Promo code created');
      }
      resetForm();
      fetchCodes();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const handleEdit = (c) => {
    setForm({ code: c.code, title: c.title, description: c.description || '', discountType: c.discountType, discountValue: c.discountValue, maxDiscount: c.maxDiscount || '', minOrderAmount: c.minOrderAmount || '', validDays: '30', usageLimit: c.usageLimit || '', usagePerUser: c.usagePerUser || '1', isNewUserOnly: c.isNewUserOnly || false });
    setEditId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this promo code?')) return;
    try {
      await api.delete(`/admin/promos/${id}`);
      toast.success('Promo code deleted');
      fetchCodes();
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Promo Codes</h2>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
          {showForm ? <HiX className="w-4 h-4" /> : <HiPlus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Promo'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <h3 className="font-semibold mb-4">{editId ? 'Edit Promo Code' : 'New Promo Code'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <input placeholder="Code (e.g. SUMMER25)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} disabled={!!editId} className="px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100" />
            <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })} className="px-3 py-2 border rounded-lg text-sm">
              <option value="percentage">Percentage (%)</option>
              <option value="flat">Flat (₹)</option>
            </select>
            <input placeholder="Discount Value" type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Max Discount cap (₹)" type="number" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Min Order Amount (₹)" type="number" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Valid Days" type="number" value={form.validDays} onChange={(e) => setForm({ ...form, validDays: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Usage Limit (empty=unlimited)" type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Per User Limit" type="number" value={form.usagePerUser} onChange={(e) => setForm({ ...form, usagePerUser: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
          </div>
          <textarea placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full mt-3 px-3 py-2 border rounded-lg text-sm" rows={2} />
          <div className="mt-3 flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isNewUserOnly} onChange={(e) => setForm({ ...form, isNewUserOnly: e.target.checked })} className="rounded text-primary" />
              <span className="text-sm font-medium text-gray-700">New Users Only</span>
              <span className="text-xs text-gray-400">(First-time order discount)</span>
            </label>
          </div>
          <button onClick={handleSave} className="mt-4 px-4 py-2 bg-secondary text-white rounded-lg text-sm hover:bg-secondary-dark">
            {editId ? 'Update' : 'Save'} Promo
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Discount</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Min Order</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Used</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : codes.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No promo codes found</td></tr>
              ) : (
                codes.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                    <td className="px-4 py-3">{c.title}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {c.discountType === 'percentage' ? `${c.discountValue}%` : `₹${c.discountValue}`}
                      {c.maxDiscount && <span className="text-xs text-gray-400 ml-1">(max ₹{c.maxDiscount})</span>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">₹{c.minOrderAmount}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">{c.usedCount}/{c.usageLimit || '∞'}</td>
                    <td className="px-4 py-3">
                      {c.daysRemaining > 0 ? (
                        <span className="px-2 py-1 bg-green-50 text-green-600 rounded-full text-xs">{c.daysRemaining}d</span>
                      ) : (
                        <span className="px-2 py-1 bg-red-50 text-red-500 rounded-full text-xs">Expired</span>
                      )}
                      {c.isNewUserOnly && <span className="ml-1 px-2 py-1 bg-purple-50 text-purple-600 rounded-full text-xs">New User</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(c)} className="p-1 text-gray-400 hover:text-blue-500"><HiPencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(c.id)} className="p-1 text-gray-400 hover:text-red-500"><HiTrash className="w-4 h-4" /></button>
                      </div>
                    </td>
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
