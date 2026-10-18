import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { HiPlus, HiPencil, HiTrash, HiX } from 'react-icons/hi';
import { useLocations } from '../context/LocationContext';

export default function PincodesPage() {
  const { locations, selectedId } = useLocations();
  const storeName = (id) => locations.find(l => l.id === id)?.name;
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ pincode: '', city: '', state: '', area: '', deliveryDays: '2', minimumOrder: '99', locationId: selectedId || '' });

  useEffect(() => { fetchAreas(); }, []);

  const fetchAreas = async () => {
    setLoading(true);
    try {
      const res = await api.get('/location/serviceable-areas');
      setAreas(res.data || []);
    } catch (err) {
      toast.error('Failed to fetch areas');
    } finally {
      setLoading(false);
    }
  };

  const shown = selectedId ? areas.filter(a => a.locationId === selectedId) : areas;

  const resetForm = () => {
    setForm({ pincode: '', city: '', state: '', area: '', deliveryDays: '2', minimumOrder: '99', locationId: selectedId || '' });
    setEditId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.pincode || !form.city) { toast.error('Pincode and city are required'); return; }
    if (form.pincode.length !== 6) { toast.error('Pincode must be 6 digits'); return; }
    if (!form.locationId) { toast.error('Choose the store that serves this pincode'); return; }
    try {
      const payload = { ...form, deliveryDays: parseInt(form.deliveryDays) || 2, minimumOrder: parseFloat(form.minimumOrder) || 99 };
      if (editId) {
        await api.put(`/admin/pincodes/${editId}`, payload);
        toast.success('Pincode updated');
      } else {
        await api.post('/admin/pincodes', payload);
        toast.success('Pincode added');
      }
      resetForm();
      fetchAreas();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const handleEdit = (a) => {
    setForm({ pincode: a.pincode, city: a.city, state: a.state || '', area: a.area || '', deliveryDays: a.deliveryDays?.toString() || '2', minimumOrder: a.minimumOrder?.toString() || '99', locationId: a.locationId || '' });
    setEditId(a.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this serviceable area?')) return;
    try {
      await api.delete(`/admin/pincodes/${id}`);
      toast.success('Pincode deleted');
      fetchAreas();
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Serviceable Areas</h2>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
          {showForm ? <HiX className="w-4 h-4" /> : <HiPlus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Pincode'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <h3 className="font-semibold mb-4">{editId ? 'Edit Pincode' : 'Add New Serviceable Pincode'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <input placeholder="Pincode (6 digits)" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} disabled={!!editId} className="px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100" maxLength={6} />
            <input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Area Name" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Delivery Days" type="number" value={form.deliveryDays} onChange={(e) => setForm({ ...form, deliveryDays: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Min Order (₹)" type="number" value={form.minimumOrder} onChange={(e) => setForm({ ...form, minimumOrder: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} className="px-3 py-2 border rounded-lg text-sm bg-white" aria-label="Served by store">
              <option value="">Served by store… *</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}{l.isActive ? '' : ' (inactive)'}</option>)}
            </select>
          </div>
          <p className="mt-2 text-xs text-gray-500">Online orders picked up in this pincode go to this store and use its prices.</p>
          <button onClick={handleSave} className="mt-4 px-4 py-2 bg-secondary text-white rounded-lg text-sm hover:bg-secondary-dark">
            {editId ? 'Update' : 'Save'} Pincode
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Pincode</th>
                <th className="px-4 py-3 text-left">Area</th>
                <th className="px-4 py-3 text-left">Store</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">City</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">State</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Delivery</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Min Order</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No areas found</td></tr>
              ) : (
                shown.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium">{a.pincode}</td>
                    <td className="px-4 py-3">{a.area || '—'}</td>
                    <td className="px-4 py-3">{storeName(a.locationId) || <span className="text-orange-500 text-xs">Not assigned</span>}</td>
                    <td className="px-4 py-3 hidden md:table-cell">{a.city}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">{a.state || '—'}</td>
                    <td className="px-4 py-3 hidden md:table-cell">{a.deliveryDays} days</td>
                    <td className="px-4 py-3 hidden lg:table-cell">₹{a.minimumOrder}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(a)} className="p-1 text-gray-400 hover:text-blue-500"><HiPencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(a.id)} className="p-1 text-gray-400 hover:text-red-500"><HiTrash className="w-4 h-4" /></button>
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
