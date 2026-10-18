import { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
  HiPlus, HiPencil, HiX, HiOutlineOfficeBuilding, HiOutlineLocationMarker, HiOutlinePhone,
  HiOutlineCurrencyRupee, HiOutlineUserAdd, HiOutlineSearch, HiEye, HiEyeOff, HiOutlineClock,
} from 'react-icons/hi';
import { useLocations } from '../context/LocationContext';

const EMPTY_LOCATION = { name: '', code: '', invoicePrefix: '', addressLine: '', city: '', state: '', pincode: '', phone: '', email: '', gstin: '', sortOrder: '0', isActive: true };
const EMPTY_MANAGER = { name: '', email: '', phone: '', password: '', locationId: '' };

function Modal({ title, onClose, wide = false, children, footer }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white rounded-xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Close"><HiX className="w-5 h-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t bg-gray-50 rounded-b-xl">{footer}</div>}
      </div>
    </div>
  );
}

function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}

const inputClass = 'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary';

export default function LocationsPage() {
  const { refresh: refreshSwitcher } = useLocations();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationForm, setLocationForm] = useState(null); // { id?, ...fields }
  const [managerForm, setManagerForm] = useState(null); // { id?, ...fields }
  const [showPassword, setShowPassword] = useState(false);
  const [pricesFor, setPricesFor] = useState(null); // location
  const [slotsFor, setSlotsFor] = useState(null); // location
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchLocations(); }, []);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/locations');
      setLocations(res.data || []);
    } catch (err) {
      toast.error('Failed to fetch locations');
    } finally {
      setLoading(false);
    }
  };

  const reloadAll = () => { fetchLocations(); refreshSwitcher(); };

  // ===== Locations =====
  const openNewLocation = () => setLocationForm({ ...EMPTY_LOCATION });
  const openEditLocation = (l) => setLocationForm({
    id: l.id, name: l.name, code: l.code, invoicePrefix: l.invoicePrefix, addressLine: l.addressLine || '', city: l.city || '',
    state: l.state || '', pincode: l.pincode || '', phone: l.phone || '', email: l.email || '', gstin: l.gstin || '',
    sortOrder: String(l.sortOrder ?? 0), isActive: l.isActive,
  });

  const saveLocation = async () => {
    const f = locationForm;
    if (!f.name.trim() || !f.code.trim()) { toast.error('Name and code are required'); return; }
    setSaving(true);
    try {
      const payload = { ...f, sortOrder: parseInt(f.sortOrder) || 0 };
      delete payload.id;
      if (f.id) {
        await api.put(`/admin/locations/${f.id}`, payload);
        toast.success('Location updated');
      } else {
        await api.post('/admin/locations', payload);
        toast.success('Location added');
      }
      setLocationForm(null);
      reloadAll();
    } catch (err) {
      toast.error(err.message || 'Failed to save location');
    } finally {
      setSaving(false);
    }
  };

  const toggleLocation = async (l) => {
    if (l.isActive && !window.confirm(`Deactivate ${l.name}? Its managers can't log in and it stops taking new orders until you activate it again.`)) return;
    try {
      await api.put(`/admin/locations/${l.id}`, { isActive: !l.isActive });
      toast.success(l.isActive ? 'Location deactivated' : 'Location activated');
      reloadAll();
    } catch (err) {
      toast.error(err.message || 'Failed to update');
    }
  };

  // ===== Managers =====
  const openNewManager = (l) => { setShowPassword(false); setManagerForm({ ...EMPTY_MANAGER, locationId: l.id }); };
  const openEditManager = (m, l) => { setShowPassword(false); setManagerForm({ id: m.id, name: m.name, email: m.email, phone: m.phone, password: '', locationId: l.id }); };

  const saveManager = async () => {
    const f = managerForm;
    if (!f.name || !f.email || !f.phone) { toast.error('Name, email and phone are required'); return; }
    if (!f.id && !f.password) { toast.error('Set a password for the new manager'); return; }
    setSaving(true);
    try {
      if (f.id) {
        const payload = { name: f.name, email: f.email, phone: f.phone, locationId: f.locationId };
        if (f.password) payload.password = f.password;
        await api.put(`/admin/managers/${f.id}`, payload);
        toast.success('Manager updated');
      } else {
        await api.post(`/admin/locations/${f.locationId}/managers`, { name: f.name, email: f.email, phone: f.phone, password: f.password });
        toast.success('Manager added');
      }
      setManagerForm(null);
      fetchLocations();
    } catch (err) {
      toast.error(err.message || 'Failed to save manager');
    } finally {
      setSaving(false);
    }
  };

  const toggleManager = async (m) => {
    try {
      await api.put(`/admin/managers/${m.id}`, { isActive: !m.isActive });
      toast.success(m.isActive ? 'Manager deactivated' : 'Manager activated');
      fetchLocations();
    } catch (err) {
      toast.error(err.message || 'Failed to update');
    }
  };

  const setLoc = (key) => (e) => setLocationForm({ ...locationForm, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setMgr = (key) => (e) => setManagerForm({ ...managerForm, [key]: e.target.value });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Locations</h2>
          <p className="text-sm text-gray-500">Your laundry stores. Each store has its own pincodes, delivery boys, prices, managers and invoice series.</p>
        </div>
        <button onClick={openNewLocation} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
          <HiPlus className="w-4 h-4" /> Add Location
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {[0, 1].map(i => <div key={i} className="h-64 rounded-xl bg-white shadow-sm animate-pulse" />)}
        </div>
      ) : locations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">No locations yet. Add your first store.</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {locations.map((l) => (
            <div key={l.id} className={`bg-white rounded-xl shadow-sm p-5 flex flex-col ${l.isActive ? '' : 'opacity-70'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-primary/15 text-secondary flex items-center justify-center flex-shrink-0">
                    <HiOutlineOfficeBuilding className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-800 truncate">{l.name}</h3>
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[11px] font-mono font-semibold">{l.code}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${l.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>{l.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Next invoice <span className="font-mono">{l.invoicePrefix}-{String(l.invoiceCounter + 1).padStart(5, '0')}</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setPricesFor(l)} className="flex items-center gap-1 px-2.5 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-gray-50" title="Prices at this store">
                    <HiOutlineCurrencyRupee className="w-4 h-4" /> Prices
                  </button>
                  <button onClick={() => setSlotsFor(l)} className="flex items-center gap-1 px-2.5 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-gray-50" title="Pickup slot capacity at this store">
                    <HiOutlineClock className="w-4 h-4" /> Slots
                  </button>
                  <button onClick={() => openEditLocation(l)} className="p-1.5 text-gray-400 hover:text-blue-500" title="Edit" aria-label={`Edit ${l.name}`}><HiPencil className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="mt-3 space-y-1 text-sm text-gray-600">
                <p className="flex items-start gap-1.5"><HiOutlineLocationMarker className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                  {[l.addressLine, l.city, l.state, l.pincode].filter(Boolean).join(', ') || <span className="text-gray-400">No address yet</span>}
                </p>
                <p className="flex items-center gap-1.5"><HiOutlinePhone className="w-4 h-4 text-gray-400" />{l.phone || <span className="text-gray-400">No phone</span>}
                  {l.gstin && <span className="ml-3 text-xs text-gray-500">GSTIN <span className="font-mono">{l.gstin}</span></span>}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4">
                {[['Orders', l.counts.orders], ['Pincodes', l.counts.pincodes], ['Delivery boys', l.counts.drivers]].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-lg font-bold text-gray-800 leading-tight">{value}</p>
                    <p className="text-[11px] text-gray-500">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t flex-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Branch managers</p>
                  <button onClick={() => openNewManager(l)} className="flex items-center gap-1 text-xs text-secondary hover:underline"><HiOutlineUserAdd className="w-4 h-4" /> Add manager</button>
                </div>
                {l.managers.length === 0 ? (
                  <p className="text-xs text-gray-400">No manager yet. Admins can still run this store.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {l.managers.map(m => (
                      <li key={m.id} className="flex items-center gap-2 text-sm">
                        <span className={`w-2 h-2 rounded-full ${m.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="font-medium text-gray-700">{m.name}</span>
                        <span className="text-xs text-gray-400 truncate">{m.email}</span>
                        <div className="ml-auto flex items-center gap-2">
                          <button onClick={() => toggleManager(m)} className={`text-xs ${m.isActive ? 'text-gray-400 hover:text-red-500' : 'text-green-600 hover:underline'}`}>{m.isActive ? 'Deactivate' : 'Activate'}</button>
                          <button onClick={() => openEditManager(m, l)} className="p-1 text-gray-400 hover:text-blue-500" aria-label={`Edit ${m.name}`}><HiPencil className="w-3.5 h-3.5" /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <button onClick={() => toggleLocation(l)} className={`text-xs ${l.isActive ? 'text-gray-400 hover:text-red-500' : 'text-green-600 hover:underline'}`}>
                  {l.isActive ? 'Deactivate location' : 'Activate location'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Location form */}
      {locationForm && (
        <Modal
          title={locationForm.id ? `Edit ${locationForm.name || 'location'}` : 'Add location'}
          onClose={() => setLocationForm(null)}
          footer={(
            <div className="flex justify-end gap-2">
              <button onClick={() => setLocationForm(null)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 bg-white">Cancel</button>
              <button onClick={saveLocation} disabled={saving} className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary-dark disabled:opacity-50">{saving ? 'Saving…' : 'Save location'}</button>
            </div>
          )}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Store name *" className="sm:col-span-2"><input value={locationForm.name} onChange={setLoc('name')} placeholder="e.g. NClean Koramangala" className={inputClass} /></Field>
            <Field label="Short code *" hint="2-10 letters/digits, e.g. KRM">
              <input value={locationForm.code} onChange={(e) => setLocationForm({ ...locationForm, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) })} className={`${inputClass} font-mono`} />
            </Field>
            <Field label="Invoice prefix" hint={`Bills are numbered ${(locationForm.invoicePrefix || locationForm.code || 'KRM')}-00001…`}>
              <input value={locationForm.invoicePrefix} onChange={(e) => setLocationForm({ ...locationForm, invoicePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) })} placeholder={locationForm.code || 'Same as code'} className={`${inputClass} font-mono`} />
            </Field>
            <Field label="Address" className="sm:col-span-2"><input value={locationForm.addressLine} onChange={setLoc('addressLine')} placeholder="Shop no., street, landmark" className={inputClass} /></Field>
            <Field label="City"><input value={locationForm.city} onChange={setLoc('city')} className={inputClass} /></Field>
            <Field label="State"><input value={locationForm.state} onChange={setLoc('state')} className={inputClass} /></Field>
            <Field label="Pincode"><input value={locationForm.pincode} inputMode="numeric" onChange={(e) => setLocationForm({ ...locationForm, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} className={inputClass} /></Field>
            <Field label="Phone"><input value={locationForm.phone} onChange={setLoc('phone')} className={inputClass} /></Field>
            <Field label="Email"><input value={locationForm.email} type="email" onChange={setLoc('email')} className={inputClass} /></Field>
            <Field label="GSTIN" hint="Blank uses the GSTIN in GST settings">
              <input value={locationForm.gstin} onChange={(e) => setLocationForm({ ...locationForm, gstin: e.target.value.toUpperCase().slice(0, 15) })} className={`${inputClass} font-mono`} />
            </Field>
            <Field label="Sort order"><input value={locationForm.sortOrder} type="number" onChange={setLoc('sortOrder')} className={inputClass} /></Field>
            <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
              <input type="checkbox" checked={locationForm.isActive} onChange={setLoc('isActive')} className="w-4 h-4 accent-secondary" /> Active (takes orders, managers can log in)
            </label>
          </div>
          <p className="mt-4 text-xs text-gray-500">Assign pincodes to this store on the <span className="font-medium">Serviceable Areas</span> page; online orders from those pincodes come here.</p>
        </Modal>
      )}

      {/* Manager form */}
      {managerForm && (
        <Modal
          title={managerForm.id ? 'Edit branch manager' : 'Add branch manager'}
          onClose={() => setManagerForm(null)}
          footer={(
            <div className="flex justify-end gap-2">
              <button onClick={() => setManagerForm(null)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 bg-white">Cancel</button>
              <button onClick={saveManager} disabled={saving} className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary-dark disabled:opacity-50">{saving ? 'Saving…' : 'Save manager'}</button>
            </div>
          )}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name *" className="sm:col-span-2"><input value={managerForm.name} onChange={setMgr('name')} className={inputClass} /></Field>
            <Field label="Email (login) *"><input value={managerForm.email} type="email" onChange={setMgr('email')} className={inputClass} /></Field>
            <Field label="Phone *"><input value={managerForm.phone} inputMode="numeric" onChange={(e) => setManagerForm({ ...managerForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} className={inputClass} /></Field>
            <Field label={managerForm.id ? 'New password' : 'Password *'} hint={managerForm.id ? 'Leave blank to keep the current password' : 'At least 8 characters'} className="sm:col-span-2">
              <div className="relative">
                <input value={managerForm.password} type={showPassword ? 'text' : 'password'} autoComplete="new-password" onChange={setMgr('password')} className={`${inputClass} pr-10`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <HiEyeOff className="w-4 h-4" /> : <HiEye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            <Field label="Store" className="sm:col-span-2">
              <select value={managerForm.locationId} onChange={setMgr('locationId')} disabled={!managerForm.id} className={`${inputClass} bg-white disabled:bg-gray-50`}>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
          </div>
          <p className="mt-4 text-xs text-gray-500">Managers log in on the same admin login page and only see this store's dashboard, orders, order status, delivery boys and POS.</p>
        </Modal>
      )}

      {pricesFor && <PricesModal location={pricesFor} onClose={() => setPricesFor(null)} />}
      {slotsFor && <SlotCapacityModal location={slotsFor} onClose={() => setSlotsFor(null)} />}
    </div>
  );
}

/** Price list for one store: override any item's price or hide it there */
function PricesModal({ location, onClose }) {
  const [rows, setRows] = useState([]);
  const [original, setOriginal] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/admin/locations/${location.id}/prices`);
        const items = (res.data?.items || []).map(i => ({ ...i, priceInput: i.price === null ? '' : String(i.price) }));
        setRows(items);
        setOriginal(Object.fromEntries(items.map(i => [i.itemId, `${i.priceInput}|${i.isAvailable}`])));
      } catch (err) {
        toast.error('Failed to load prices');
      } finally {
        setLoading(false);
      }
    })();
  }, [location.id]);

  const changed = rows.filter(r => original[r.itemId] !== `${r.priceInput}|${r.isAvailable}`);
  const visible = useMemo(() => rows.filter(r => !search.trim() || `${r.name} ${r.category || ''}`.toLowerCase().includes(search.trim().toLowerCase())), [rows, search]);
  const update = (itemId, changes) => setRows(rows.map(r => (r.itemId === itemId ? { ...r, ...changes } : r)));

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/locations/${location.id}/prices`, {
        prices: changed.map(r => ({ itemId: r.itemId, price: r.priceInput === '' ? null : parseFloat(r.priceInput), isAvailable: r.isAvailable })),
      });
      toast.success(`Saved ${changed.length} price${changed.length === 1 ? '' : 's'} for ${location.name}`);
      setOriginal(Object.fromEntries(rows.map(r => [r.itemId, `${r.priceInput}|${r.isAvailable}`])));
    } catch (err) {
      toast.error(err.message || 'Failed to save prices');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      wide
      title={`Prices at ${location.name}`}
      onClose={() => { if (!changed.length || window.confirm('Discard unsaved price changes?')) onClose(); }}
      footer={(
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500">{changed.length ? `${changed.length} unsaved change${changed.length === 1 ? '' : 's'}` : 'Blank price = catalogue price'}</span>
          <button onClick={save} disabled={saving || !changed.length} className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary-dark disabled:opacity-50">{saving ? 'Saving…' : 'Save prices'}</button>
        </div>
      )}
    >
      <div className="relative mb-3">
        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items" className={`${inputClass} pl-9`} />
      </div>
      {loading ? (
        <p className="text-center text-gray-400 py-8 text-sm">Loading…</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-gray-500 bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">Item</th>
              <th className="text-right px-3 py-2">Catalogue</th>
              <th className="text-right px-3 py-2">Price here</th>
              <th className="text-center px-3 py-2">Offered</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map(r => {
              const dirty = original[r.itemId] !== `${r.priceInput}|${r.isAvailable}`;
              return (
                <tr key={r.itemId} className={dirty ? 'bg-primary/5' : ''}>
                  <td className="px-3 py-2">
                    <p className={`font-medium ${r.isAvailable ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{r.name}</p>
                    <p className="text-[11px] text-gray-400">{r.category}{r.isActive ? '' : ' · inactive in catalogue'}</p>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500">₹{r.basePrice}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min="0"
                      value={r.priceInput}
                      placeholder={String(r.basePrice)}
                      onChange={(e) => update(r.itemId, { priceInput: e.target.value })}
                      disabled={!r.isAvailable}
                      className="w-24 px-2 py-1 border rounded text-sm text-right disabled:bg-gray-50"
                      aria-label={`Price of ${r.name} at ${location.name}`}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={r.isAvailable} onChange={(e) => update(r.itemId, { isAvailable: e.target.checked })} className="w-4 h-4 accent-secondary" aria-label={`Offer ${r.name} at ${location.name}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

/** Pickup slot capacity at one store: orders per slot per day (blank = the slot's default, 0 = closed here) */
function SlotCapacityModal({ location, onClose }) {
  const [rows, setRows] = useState([]);
  const [original, setOriginal] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchSlots = async () => {
    try {
      const res = await api.get(`/admin/locations/${location.id}/time-slots`);
      const slots = (res.data?.slots || []).map(s => ({ ...s, capacityInput: s.maxBookings === null ? '' : String(s.maxBookings) }));
      setRows(slots);
      setOriginal(Object.fromEntries(slots.map(s => [s.timeSlotId, s.capacityInput])));
      setLoadError('');
    } catch (err) {
      setLoadError(err.message || 'Failed to load slot capacity');
      toast.error(err.message || 'Failed to load slot capacity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSlots(); }, [location.id]);

  const changed = rows.filter(r => original[r.timeSlotId] !== r.capacityInput);
  const update = (timeSlotId, capacityInput) => setRows(rows.map(r => (r.timeSlotId === timeSlotId ? { ...r, capacityInput } : r)));
  const isValid = (v) => v === '' || (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 10000);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/locations/${location.id}/time-slots`, {
        slots: changed.map(r => ({ timeSlotId: r.timeSlotId, maxBookings: r.capacityInput === '' ? null : Number(r.capacityInput) })),
      });
      toast.success(`Saved capacity for ${changed.length} slot${changed.length === 1 ? '' : 's'} at ${location.name}`);
      await fetchSlots();
    } catch (err) {
      toast.error(err.message || 'Failed to save slot capacity');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Pickup slots at ${location.name}`}
      onClose={() => { if (!changed.length || window.confirm('Discard unsaved capacity changes?')) onClose(); }}
      footer={(
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500">{changed.length ? `${changed.length} unsaved change${changed.length === 1 ? '' : 's'}` : 'Blank = slot default · 0 closes the slot here'}</span>
          <button onClick={save} disabled={saving || !changed.length} className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary-dark disabled:opacity-50">{saving ? 'Saving…' : 'Save capacity'}</button>
        </div>
      )}
    >
      <p className="text-xs text-gray-500 mb-3">How many pickups each slot takes per day at this store. Other stores keep their own count.</p>
      {loading ? (
        <p className="text-center text-gray-400 py-8 text-sm">Loading…</p>
      ) : loadError && rows.length === 0 ? (
        <p className="text-center text-red-500 py-8 text-sm">{loadError}</p>
      ) : rows.length === 0 ? (
        <p className="text-center text-gray-400 py-8 text-sm">No pickup time slots set up yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-gray-500 bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">Slot</th>
              <th className="text-right px-3 py-2">Default</th>
              <th className="text-right px-3 py-2">Capacity here</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(r => {
              const dirty = original[r.timeSlotId] !== r.capacityInput;
              const valid = isValid(r.capacityInput);
              const closed = r.capacityInput !== '' && Number(r.capacityInput) === 0;
              return (
                <tr key={r.timeSlotId} className={dirty ? 'bg-primary/5' : ''}>
                  <td className="px-3 py-2">
                    <p className={`font-medium ${closed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{r.label}</p>
                    <p className="text-[11px] text-gray-400">
                      {closed ? 'Closed at this store' : r.capacityInput === '' ? 'Uses default' : 'Own capacity'}{r.isActive ? '' : ' · inactive slot'}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500">{r.baseMaxBookings}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.capacityInput !== '' && (
                        <button onClick={() => update(r.timeSlotId, '')} className="text-xs text-gray-400 hover:text-secondary" title="Use the slot's default capacity">Default</button>
                      )}
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        step="1"
                        value={r.capacityInput}
                        placeholder={String(r.baseMaxBookings)}
                        onChange={(e) => update(r.timeSlotId, e.target.value)}
                        aria-invalid={!valid}
                        className={`w-24 px-2 py-1 border rounded text-sm text-right ${valid ? '' : 'border-red-400 bg-red-50'}`}
                        aria-label={`Pickups per day in ${r.label} at ${location.name}`}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
