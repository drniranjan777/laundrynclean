import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { HiPlus, HiPencil, HiTrash, HiX, HiEye, HiEyeOff } from 'react-icons/hi';
import { useLocations } from '../context/LocationContext';

export default function DeliveryBoysPage() {
  const { locations, selectedId, isManager } = useLocations();
  const activeStores = locations.filter(l => l.isActive);
  const defaultStore = () => selectedId || activeStores[0]?.id || '';
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', locationId: '' });

  useEffect(() => { fetchDrivers(); }, []);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/delivery-boys');
      setDrivers(res.data || []);
    } catch (err) {
      toast.error('Failed to fetch delivery boys');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ name: '', email: '', phone: '', password: '', locationId: defaultStore() });
    setEditId(null);
    setShowForm(false);
    setShowPassword(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.phone) { toast.error('Name and phone are required'); return; }
    if (!/^[6-9]\d{9}$/.test(form.phone)) { toast.error('Enter a valid 10-digit mobile number; it is their login'); return; }
    if (!isManager && !form.locationId) { toast.error('Choose the store this delivery boy works at'); return; }
    try {
      if (editId) {
        const payload = { name: form.name, email: form.email, phone: form.phone };
        if (!isManager) payload.locationId = form.locationId;
        if (form.password) payload.password = form.password;
        await api.put(`/admin/delivery-boys/${editId}`, payload);
        toast.success('Delivery boy updated');
      } else {
        await api.post('/admin/delivery-boys', form);
        toast.success('Delivery boy created');
      }
      resetForm();
      fetchDrivers();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const handleEdit = (d) => {
    setForm({ name: d.name, email: d.email || '', phone: d.phone, password: '', locationId: d.locationId || defaultStore() });
    setEditId(d.id);
    setShowForm(true);
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      await api.put(`/admin/delivery-boys/${id}`, { isActive: !currentStatus });
      toast.success(currentStatus ? 'Deactivated' : 'Activated');
      fetchDrivers();
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this delivery boy?')) return;
    try {
      await api.delete(`/admin/delivery-boys/${id}`);
      toast.success('Delivery boy deactivated');
      fetchDrivers();
    } catch (err) {
      toast.error(err.message || 'Failed');
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Delivery Boys</h2>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
          {showForm ? <HiX className="w-4 h-4" /> : <HiPlus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Delivery Boy'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6 border-l-4 border-secondary">
          <h3 className="font-semibold mb-4">{editId ? 'Edit Delivery Boy' : 'Create New Delivery Boy'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input placeholder="Full Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Mobile number (login) *" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Email (optional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <div className="relative">
              <input
                placeholder={editId ? 'New password (optional, leave empty to keep)' : 'Password (optional)'}
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-gray-400">
                {showPassword ? <HiEyeOff className="w-4 h-4" /> : <HiEye className="w-4 h-4" />}
              </button>
            </div>
            {!isManager && (
              <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} className="px-3 py-2 border rounded-lg text-sm bg-white" aria-label="Store">
                <option value="">Works at store… *</option>
                {activeStores.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
          </div>
          <p className="mt-3 text-xs text-gray-500">Delivery boys sign in to the driver app with this mobile number and an OTP. Email and password are only needed for the older email login.</p>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} className="px-4 py-2 bg-secondary text-white rounded-lg text-sm">{editId ? 'Update' : 'Create'} Delivery Boy</button>
            <button onClick={resetForm} className="px-4 py-2 border rounded-lg text-sm text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Email</th>
                {!isManager && <th className="px-4 py-3 text-left hidden md:table-cell">Store</th>}
                <th className="px-4 py-3 text-left hidden lg:table-cell">Active Orders</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Delivered</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : drivers.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No delivery boys found. Create one to get started.</td></tr>
              ) : (
                drivers.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{d.name}</td>
                    <td className="px-4 py-3">{d.phone}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500">{d.email || <span className="text-gray-300">—</span>}</td>
                    {!isManager && <td className="px-4 py-3 hidden md:table-cell">{d.location?.name || <span className="text-gray-300">—</span>}</td>}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {d.activeOrders > 0 ? (
                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">{d.activeOrders}</span>
                      ) : <span className="text-gray-300">0</span>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-green-600 font-medium">{d.totalDelivered}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(d.id, d.isActive)}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${d.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}
                      >
                        {d.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(d)} className="p-1 text-gray-400 hover:text-blue-500"><HiPencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(d.id)} className="p-1 text-gray-400 hover:text-red-500"><HiTrash className="w-4 h-4" /></button>
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
