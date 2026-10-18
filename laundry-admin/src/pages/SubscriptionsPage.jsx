import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { HiPlus, HiPencil, HiTrash, HiX } from 'react-icons/hi';

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', price: '', description: '', durationType: 'month', freeDelivery: false, discountPercent: '', trialDays: '' });

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await api.get('/subscriptions/plans');
      setPlans(res.data?.plans || []);
    } catch (err) {
      toast.error('Failed to fetch plans');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ name: '', price: '', description: '', durationType: 'month', freeDelivery: false, discountPercent: '', trialDays: '' });
    setEditId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) { toast.error('Name and price are required'); return; }
    try {
      const payload = { ...form, price: parseFloat(form.price), discountPercent: parseFloat(form.discountPercent) || 0, trialDays: parseInt(form.trialDays) || 0 };
      if (editId) {
        await api.put(`/admin/plans/${editId}`, payload);
        toast.success('Plan updated');
      } else {
        await api.post('/admin/plans', payload);
        toast.success('Plan created');
      }
      resetForm();
      fetchPlans();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const handleEdit = (plan) => {
    setForm({ name: plan.name, price: plan.price, description: plan.description || '', durationType: plan.durationType || 'month', freeDelivery: plan.freeDelivery, discountPercent: plan.discountPercent || '', trialDays: plan.trialDays || '' });
    setEditId(plan.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;
    try {
      await api.delete(`/admin/plans/${id}`);
      toast.success('Plan deleted');
      fetchPlans();
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Subscription Plans</h2>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
          {showForm ? <HiX className="w-4 h-4" /> : <HiPlus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Plan'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <h3 className="font-semibold mb-4">{editId ? 'Edit Plan' : 'New Plan'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <input placeholder="Plan Name (e.g. Basic)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Price (₹/month)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <select value={form.durationType} onChange={(e) => setForm({ ...form, durationType: e.target.value })} className="px-3 py-2 border rounded-lg text-sm">
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
              <option value="days">Custom Days</option>
            </select>
            <input placeholder="Discount % on services" type="number" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Trial Days (0 = none)" type="number" value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <label className="flex items-center gap-2 px-3 py-2">
              <input type="checkbox" checked={form.freeDelivery} onChange={(e) => setForm({ ...form, freeDelivery: e.target.checked })} className="rounded" />
              <span className="text-sm">Free Delivery</span>
            </label>
          </div>
          <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full mt-3 px-3 py-2 border rounded-lg text-sm" rows={2} />
          <button onClick={handleSave} className="mt-4 px-4 py-2 bg-secondary text-white rounded-lg text-sm hover:bg-secondary-dark">
            {editId ? 'Update' : 'Save'} Plan
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-center py-8">Loading...</p>
      ) : plans.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No plans found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-white rounded-xl shadow-sm p-5 relative">
              <div className="absolute top-3 right-3 flex gap-1">
                <button onClick={() => handleEdit(plan)} className="p-1 text-gray-400 hover:text-blue-500"><HiPencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(plan.id)} className="p-1 text-gray-400 hover:text-red-500"><HiTrash className="w-4 h-4" /></button>
              </div>
              <h3 className="text-lg font-bold text-gray-800">{plan.name}</h3>
              <p className="text-2xl font-bold text-primary mt-2">₹{plan.price}<span className="text-sm text-gray-400 font-normal">/{plan.durationType || 'month'}</span></p>
              <p className="text-sm text-gray-500 mt-2">{plan.description}</p>
              <div className="mt-3 flex gap-2 text-xs flex-wrap">
                {plan.freeDelivery && <span className="px-2 py-1 bg-green-50 text-green-600 rounded-full">Free Delivery</span>}
                {plan.discountPercent > 0 && <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-full">{plan.discountPercent}% Off</span>}
                {plan.trialDays > 0 && <span className="px-2 py-1 bg-yellow-50 text-yellow-600 rounded-full">{plan.trialDays}d Trial</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
