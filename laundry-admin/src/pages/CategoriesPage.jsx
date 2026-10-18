import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { HiPlus, HiPencil, HiTrash, HiX } from 'react-icons/hi';
import ClothIconPicker from '../components/ClothIconPicker';
import { categoryIcon, clothIcon } from '../components/clothIcons';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [catEditId, setCatEditId] = useState(null);
  const [catForm, setCatForm] = useState({ name: '', slug: '', icon: '' });

  // Sub-category form
  const [showSubForm, setShowSubForm] = useState(false);
  const [subEditId, setSubEditId] = useState(null);
  const [subCategoryId, setSubCategoryId] = useState(null);
  const [subForm, setSubForm] = useState({ name: '', slug: '', color: '' });

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await api.get('/categories');
      setCategories(res.data || []);
    } catch (err) {
      toast.error('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  // ===== Category =====
  const resetCatForm = () => { setCatForm({ name: '', slug: '', icon: '' }); setCatEditId(null); setShowCatForm(false); };

  const handleSaveCat = async () => {
    if (!catForm.name || !catForm.slug) { toast.error('Name and slug are required'); return; }
    try {
      if (catEditId) {
        await api.put(`/admin/categories/${catEditId}`, catForm);
        toast.success('Category updated');
      } else {
        await api.post('/admin/categories', catForm);
        toast.success('Category created');
      }
      resetCatForm();
      fetchCategories();
    } catch (err) { toast.error(err.message || 'Failed'); }
  };

  const handleEditCat = (cat) => {
    setCatForm({ name: cat.name, slug: cat.slug, icon: cat.icon || '' });
    setCatEditId(cat.id);
    setShowCatForm(true);
    setShowSubForm(false);
  };

  const handleDeleteCat = async (id) => {
    if (!confirm('Delete this category and all its subcategories?')) return;
    try { await api.delete(`/admin/categories/${id}`); toast.success('Deleted'); fetchCategories(); }
    catch (err) { toast.error(err.message || 'Failed'); }
  };

  // ===== Sub-category =====
  const resetSubForm = () => { setSubForm({ name: '', slug: '', color: '' }); setSubEditId(null); setSubCategoryId(null); setShowSubForm(false); };

  const handleAddSub = (categoryId) => {
    resetSubForm();
    setSubCategoryId(categoryId);
    setShowSubForm(true);
    setShowCatForm(false);
  };

  const handleSaveSub = async () => {
    if (!subForm.name || !subForm.slug) { toast.error('Name and slug are required'); return; }
    try {
      if (subEditId) {
        await api.put(`/admin/subcategories/${subEditId}`, subForm);
        toast.success('Sub-category updated');
      } else {
        await api.post('/admin/subcategories', { ...subForm, categoryId: subCategoryId });
        toast.success('Sub-category created');
      }
      resetSubForm();
      fetchCategories();
    } catch (err) { toast.error(err.message || 'Failed'); }
  };

  const handleEditSub = (sub, categoryId) => {
    setSubForm({ name: sub.name, slug: sub.slug, color: sub.color || '' });
    setSubEditId(sub.id);
    setSubCategoryId(categoryId);
    setShowSubForm(true);
    setShowCatForm(false);
  };

  const handleDeleteSub = async (id) => {
    if (!confirm('Delete this sub-category?')) return;
    try { await api.delete(`/admin/subcategories/${id}`); toast.success('Deleted'); fetchCategories(); }
    catch (err) { toast.error(err.message || 'Failed'); }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Categories</h2>
        <button onClick={() => { resetCatForm(); resetSubForm(); setShowCatForm(!showCatForm); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
          {showCatForm ? <HiX className="w-4 h-4" /> : <HiPlus className="w-4 h-4" />}
          {showCatForm ? 'Cancel' : 'Add Category'}
        </button>
      </div>

      {/* Category Form */}
      {showCatForm && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <h3 className="font-semibold mb-4">{catEditId ? 'Edit Category' : 'New Category'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input placeholder="Name (e.g. Garment)" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value, slug: catEditId ? catForm.slug : e.target.value.toLowerCase().replace(/\s+/g, '-') })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Slug (e.g. garment)" value={catForm.slug} onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <ClothIconPicker
              className="sm:col-span-3 pt-3 border-t"
              value={catForm.icon}
              onChange={(icon) => setCatForm({ ...catForm, icon })}
              autoIcon={categoryIcon(catForm.icon)}
              autoLabel={catForm.icon ? `Icon: ${catForm.icon}` : 'No icon (hanger)'}
              emptyLabel="None (hanger)"
              clearLabel="Remove icon"
            />
          </div>
          <button onClick={handleSaveCat} className="mt-4 px-4 py-2 bg-secondary text-white rounded-lg text-sm">{catEditId ? 'Update' : 'Save'} Category</button>
        </div>
      )}

      {/* Sub-category Form */}
      {showSubForm && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6 border-l-4 border-secondary">
          <h3 className="font-semibold mb-4">{subEditId ? 'Edit Sub-category' : 'New Sub-category'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input placeholder="Name (e.g. Woman, Man, Kids)" value={subForm.name} onChange={(e) => setSubForm({ ...subForm, name: e.target.value, slug: subEditId ? subForm.slug : e.target.value.toLowerCase().replace(/\s+/g, '-') })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Slug (e.g. woman)" value={subForm.slug} onChange={(e) => setSubForm({ ...subForm, slug: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Color code (e.g. #00857A)" value={subForm.color} onChange={(e) => setSubForm({ ...subForm, color: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSaveSub} className="px-4 py-2 bg-secondary text-white rounded-lg text-sm">{subEditId ? 'Update' : 'Save'} Sub-category</button>
            <button onClick={resetSubForm} className="px-4 py-2 border rounded-lg text-sm text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {/* Categories List */}
      {loading ? (
        <p className="text-gray-400 text-center py-8">Loading...</p>
      ) : categories.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No categories found.</p>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => {
            const Icon = categoryIcon(cat.icon);
            return (
            <div key={cat.id} className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-primary/15 text-secondary flex items-center justify-center flex-shrink-0"><Icon className="w-6 h-6" /></span>
                  <div>
                    <h3 className="font-semibold text-gray-800">{cat.name}</h3>
                    <p className="text-xs text-gray-400">Slug: {cat.slug} {cat.icon && `| Icon: ${clothIcon(cat.icon)?.label || cat.icon}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleAddSub(cat.id)} className="px-3 py-1.5 bg-secondary/10 text-secondary rounded-lg text-xs font-medium hover:bg-secondary/20">+ Sub-category</button>
                  <button onClick={() => handleEditCat(cat)} className="p-1.5 text-gray-400 hover:text-blue-500"><HiPencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDeleteCat(cat.id)} className="p-1.5 text-gray-400 hover:text-red-500"><HiTrash className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Sub-categories */}
              {cat.subCategories?.length > 0 ? (
                <div className="space-y-2">
                  {cat.subCategories.map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        {sub.color && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sub.color }} />}
                        <span className="text-sm font-medium">{sub.name}</span>
                        <span className="text-xs text-gray-400">({sub.slug})</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleEditSub(sub, cat.id)} className="p-1 text-gray-400 hover:text-blue-500"><HiPencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteSub(sub.id)} className="p-1 text-gray-400 hover:text-red-500"><HiTrash className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No sub-categories. Click "+ Sub-category" to add.</p>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
