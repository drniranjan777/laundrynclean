import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { HiPlus, HiPencil, HiTrash, HiX, HiSearch } from 'react-icons/hi';
import ClothIconPicker from '../components/ClothIconPicker';
import { clothIcon, iconKeyForName, itemIcon } from '../components/clothIcons';

const EMPTY_FORM = {
  categoryId: '', subCategoryId: '', name: '', brand: '', price: '', originalPrice: '',
  discountPercent: '', colors: '', sizes: '', icon: '', isAddOn: false, isLimitedOffer: false,
};

export default function CataloguePage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterSubCat, setFilterSubCat] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Item form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => { fetchCategories(); }, []);

  // POS links here as /catalogue?new=1&name=…&categoryId=… to save a custom item for next time
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    setForm({ ...EMPTY_FORM, name: searchParams.get('name') || '', categoryId: searchParams.get('categoryId') || '' });
    setEditId(null);
    setShowForm(true);
    setSearchParams({}, { replace: true });
  }, []);
  useEffect(() => { fetchItems(); }, [page, filterCat, filterSubCat]);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data || []);
    } catch (err) { /* ignore */ }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      if (filterCat) {
        const params = { page, limit: 15 };
        if (filterSubCat) params.subCategoryId = filterSubCat;
        if (search) params.search = search;
        const res = await api.get(`/categories/${filterCat}/items`, { params });
        setItems(res.data?.items || []);
        setTotalPages(res.data?.totalPages || 1);
      } else if (categories.length > 0) {
        // Load from first category by default
        const res = await api.get(`/categories/${categories[0]?.id}/items`, { params: { page, limit: 15 } });
        setItems(res.data?.items || []);
        setTotalPages(res.data?.totalPages || 1);
        if (!filterCat && categories[0]) setFilterCat(categories[0].id);
      } else {
        setItems([]);
      }
    } catch (err) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => { setPage(1); fetchItems(); };

  // Get subcategories for filter and form
  const filterSubOptions = categories.find(c => c.id === filterCat)?.subCategories || [];
  const formSubOptions = categories.find(c => c.id === form.categoryId)?.subCategories || [];

  // Icon shown when the item has none of its own: guessed from the name, else the category's
  const formCategoryIcon = categories.find(c => c.id === form.categoryId)?.icon;
  const autoIconEntry = clothIcon(iconKeyForName(form.name)) || clothIcon(formCategoryIcon);
  const listCategoryIcon = categories.find(c => c.id === filterCat)?.icon;

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.categoryId || !form.name || !form.price) { toast.error('Category, name, and price are required'); return; }
    try {
      const payload = {
        categoryId: form.categoryId,
        subCategoryId: form.subCategoryId || null,
        name: form.name,
        brand: form.brand || null,
        price: parseFloat(form.price),
        originalPrice: form.originalPrice ? parseFloat(form.originalPrice) : null,
        discountPercent: parseInt(form.discountPercent) || 0,
        colors: form.colors ? form.colors.split(',').map(c => c.trim()).filter(Boolean) : null,
        sizes: form.sizes ? form.sizes.split(',').map(s => s.trim()).filter(Boolean) : null,
        icon: form.icon || null,
        isAddOn: form.isAddOn,
        isLimitedOffer: form.isLimitedOffer,
      };
      if (editId) {
        await api.put(`/admin/items/${editId}`, payload);
        toast.success('Item updated');
      } else {
        await api.post('/admin/items', payload);
        toast.success('Item created');
      }
      resetForm();
      fetchItems();
    } catch (err) { toast.error(err.message || 'Failed to save'); }
  };

  const handleEdit = (item) => {
    setForm({
      categoryId: item.categoryId || item.category_id || filterCat || '',
      subCategoryId: item.subCategoryId || item.sub_category_id || '',
      name: item.name, brand: item.brand || '', price: item.price,
      originalPrice: item.originalPrice || '', discountPercent: item.discountPercent || '',
      colors: item.colors ? item.colors.join(', ') : '',
      sizes: item.sizes ? item.sizes.join(', ') : '',
      icon: item.icon || '',
      isAddOn: item.isAddOn || false, isLimitedOffer: item.isLimitedOffer || false,
    });
    setEditId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this item?')) return;
    try { await api.delete(`/admin/items/${id}`); toast.success('Item deleted'); fetchItems(); }
    catch (err) { toast.error(err.message || 'Failed'); }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Catalogue</h2>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
          {showForm ? <HiX className="w-4 h-4" /> : <HiPlus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Item'}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6 border-l-4 border-primary">
          <h3 className="font-semibold mb-4">{editId ? 'Edit Item' : 'New Catalogue Item'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value, subCategoryId: '' })} className="px-3 py-2 border rounded-lg text-sm">
              <option value="">Select Category *</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={form.subCategoryId} onChange={(e) => setForm({ ...form, subCategoryId: e.target.value })} className="px-3 py-2 border rounded-lg text-sm">
              <option value="">Select Sub-category (optional)</option>
              {formSubOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input placeholder="Item Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Brand (optional)" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Price (₹) *" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Original Price (₹)" type="number" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Discount %" type="number" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Colors (comma separated)" value={form.colors} onChange={(e) => setForm({ ...form, colors: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Sizes (comma separated)" value={form.sizes} onChange={(e) => setForm({ ...form, sizes: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <label className="flex items-center gap-2 px-3 py-2">
              <input type="checkbox" checked={form.isAddOn} onChange={(e) => setForm({ ...form, isAddOn: e.target.checked })} className="rounded" />
              <span className="text-sm">Add-On</span>
            </label>
            <label className="flex items-center gap-2 px-3 py-2">
              <input type="checkbox" checked={form.isLimitedOffer} onChange={(e) => setForm({ ...form, isLimitedOffer: e.target.checked })} className="rounded" />
              <span className="text-sm">Limited Offer</span>
            </label>
            <ClothIconPicker
              className="sm:col-span-2 lg:col-span-3 pt-3 border-t"
              value={form.icon}
              onChange={(icon) => setForm({ ...form, icon })}
              autoIcon={itemIcon({ name: form.name, categoryIcon: formCategoryIcon })}
              autoLabel={`Automatic: ${autoIconEntry ? autoIconEntry.label : 'hanger'}`}
              emptyLabel="Auto (from name)"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} className="px-4 py-2 bg-secondary text-white rounded-lg text-sm">{editId ? 'Update' : 'Save'} Item</button>
            <button onClick={resetForm} className="px-4 py-2 border rounded-lg text-sm text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select value={filterCat} onChange={(e) => { setFilterCat(e.target.value); setFilterSubCat(''); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterSubCat} onChange={(e) => { setFilterSubCat(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All Sub-categories</option>
          {filterSubOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex gap-2 flex-1">
          <input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="flex-1 px-3 py-2 border rounded-lg text-sm" />
          <button onClick={handleSearch} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"><HiSearch className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Brand</th>
                <th className="px-4 py-3 text-left">Price</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Discount</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Sub-category</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Colors / Sizes</th>
                <th className="px-4 py-3 text-left">Tags</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No items found. Select a category or add items.</td></tr>
              ) : (
                items.map((item) => {
                  const Icon = itemIcon({ icon: item.icon, name: item.name, categoryIcon: listCategoryIcon });
                  return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-lg bg-primary/15 text-secondary flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5" /></span>
                        {item.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500">{item.brand || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">₹{item.price}</span>
                      {item.originalPrice && <span className="ml-1 line-through text-gray-400 text-xs">₹{item.originalPrice}</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {item.discountPercent > 0 ? <span className="text-green-600 font-medium">{item.discountPercent}%</span> : '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs">{item.subCategory?.name || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">
                      {item.colors ? item.colors.join(', ') : '—'} / {item.sizes ? item.sizes.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {item.isAddOn && <span className="px-1.5 py-0.5 bg-orange-50 text-orange-500 rounded text-xs">Add-On</span>}
                        {item.isLimitedOffer && <span className="px-1.5 py-0.5 bg-red-50 text-red-500 rounded text-xs">Limited</span>}
                        {!item.isAddOn && !item.isLimitedOffer && <span className="text-gray-300 text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(item)} className="p-1 text-gray-400 hover:text-blue-500"><HiPencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1 text-gray-400 hover:text-red-500"><HiTrash className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Previous</button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  );
}
