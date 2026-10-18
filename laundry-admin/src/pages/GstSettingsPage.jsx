import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function GstSettingsPage() {
  const [form, setForm] = useState({
    gstin: '', businessName: '', businessAddress: '', businessPhone: '',
    gstRate: '18', gstType: 'exclusive', hsnCode: '9971', isEnabled: true, invoicePrefix: 'INV',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/gst');
      if (res.data) {
        setForm({
          gstin: res.data.gstin || '',
          businessName: res.data.businessName || '',
          businessAddress: res.data.businessAddress || '',
          businessPhone: res.data.businessPhone || '',
          gstRate: res.data.gstRate || '18',
          gstType: res.data.gstType || 'exclusive',
          hsnCode: res.data.hsnCode || '9971',
          isEnabled: res.data.isEnabled ?? true,
          invoicePrefix: res.data.invoicePrefix || 'INV',
        });
      }
    } catch (err) { /* defaults are fine */ }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/admin/gst', { ...form, gstRate: parseFloat(form.gstRate) });
      toast.success('GST settings saved');
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-400 text-center py-12">Loading...</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">GST & Invoice Settings</h2>

      <div className="bg-white rounded-xl shadow-sm p-6 max-w-3xl">
        {/* Business Info */}
        <h3 className="font-semibold text-gray-700 mb-4">Business Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Business Name</label>
            <input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="NClean Laundry" className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Business Phone</label>
            <input value={form.businessPhone} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} placeholder="9876543210" className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Business Address</label>
            <textarea value={form.businessAddress} onChange={(e) => setForm({ ...form, businessAddress: e.target.value })} placeholder="Shop No. 5, MG Road, Bangalore 560001" className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
          </div>
        </div>

        {/* GST Config */}
        <h3 className="font-semibold text-gray-700 mb-4">GST Configuration</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">GSTIN</label>
            <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="29ABCDE1234F1ZP" maxLength={15} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">GST Rate (%)</label>
            <input type="number" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">GST Type</label>
            <select value={form.gstType} onChange={(e) => setForm({ ...form, gstType: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="exclusive">Exclusive (GST added on top)</option>
              <option value="inclusive">Inclusive (GST included in price)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">HSN Code</label>
            <input value={form.hsnCode} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} placeholder="9971" className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Invoice Numbers</label>
            <p className="px-3 py-2 border border-dashed rounded-lg text-sm text-gray-500 bg-gray-50">
              Each store has its own series. Set prefixes on the <Link to="/locations" className="text-secondary font-medium hover:underline">Locations</Link> page.
            </p>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2">
              <input type="checkbox" checked={form.isEnabled} onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })} className="rounded text-primary w-4 h-4" />
              <span className="text-sm font-medium">Enable GST</span>
            </label>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">GST Preview (on ₹1000 order)</h4>
          {form.isEnabled ? (
            <div className="text-sm space-y-1">
              {form.gstType === 'exclusive' ? (
                <>
                  <p>Subtotal: ₹1000</p>
                  <p>CGST ({parseFloat(form.gstRate) / 2}%): ₹{((1000 * parseFloat(form.gstRate) / 2) / 100).toFixed(2)}</p>
                  <p>SGST ({parseFloat(form.gstRate) / 2}%): ₹{((1000 * parseFloat(form.gstRate) / 2) / 100).toFixed(2)}</p>
                  <p className="font-bold">Total: ₹{(1000 + (1000 * parseFloat(form.gstRate)) / 100).toFixed(2)}</p>
                </>
              ) : (
                <>
                  <p>Total (incl. GST): ₹1000</p>
                  <p>Base amount: ₹{(1000 * 100 / (100 + parseFloat(form.gstRate))).toFixed(2)}</p>
                  <p>CGST ({parseFloat(form.gstRate) / 2}%): ₹{((1000 - (1000 * 100 / (100 + parseFloat(form.gstRate)))) / 2).toFixed(2)}</p>
                  <p>SGST ({parseFloat(form.gstRate) / 2}%): ₹{((1000 - (1000 * 100 / (100 + parseFloat(form.gstRate)))) / 2).toFixed(2)}</p>
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">GST is disabled. No tax will be applied.</p>
          )}
        </div>

        <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary-dark disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
