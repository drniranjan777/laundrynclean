import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { HiPlus, HiPencil, HiTrash, HiX } from 'react-icons/hi';

export default function ContentPage() {
  const [faqs, setFaqs] = useState([]);
  const [contentPages, setContentPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('faq');

  // FAQ form
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [faqEditId, setFaqEditId] = useState(null);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', category: '' });

  // Content form
  const [showContentForm, setShowContentForm] = useState(false);
  const [contentEditId, setContentEditId] = useState(null);
  const [contentForm, setContentForm] = useState({ slug: '', title: '', content: '' });

  useEffect(() => {
    fetchFaqs();
    fetchAllContent();
  }, []);

  const fetchFaqs = async () => {
    try {
      const res = await api.get('/content/faq');
      setFaqs(res.data || []);
    } catch (err) { /* empty */ }
  };

  const fetchAllContent = async () => {
    setLoading(true);
    const pages = [];
    for (const slug of ['terms', 'disclaimer', 'privacy']) {
      try {
        const res = await api.get(`/content/${slug}`);
        if (res.data) pages.push({ ...res.data, slug });
      } catch (err) { /* not found */ }
    }
    setContentPages(pages);
    setLoading(false);
  };

  // ===== FAQ handlers =====
  const resetFaqForm = () => { setFaqForm({ question: '', answer: '', category: '' }); setFaqEditId(null); setShowFaqForm(false); };

  const handleSaveFaq = async () => {
    if (!faqForm.question || !faqForm.answer) { toast.error('Question and answer are required'); return; }
    try {
      if (faqEditId) {
        await api.put(`/admin/faqs/${faqEditId}`, faqForm);
        toast.success('FAQ updated');
      } else {
        await api.post('/admin/faqs', faqForm);
        toast.success('FAQ created');
      }
      resetFaqForm();
      fetchFaqs();
    } catch (err) { toast.error(err.message || 'Failed'); }
  };

  const handleEditFaq = (faq) => {
    setFaqForm({ question: faq.question, answer: faq.answer, category: faq.category || '' });
    setFaqEditId(faq.id);
    setShowFaqForm(true);
  };

  const handleDeleteFaq = async (id) => {
    if (!confirm('Delete this FAQ?')) return;
    try { await api.delete(`/admin/faqs/${id}`); toast.success('FAQ deleted'); fetchFaqs(); }
    catch (err) { toast.error(err.message || 'Failed'); }
  };

  // ===== Content handlers =====
  const resetContentForm = () => { setContentForm({ slug: '', title: '', content: '' }); setContentEditId(null); setShowContentForm(false); };

  const handleSaveContent = async () => {
    if (!contentForm.title || !contentForm.content) { toast.error('Title and content are required'); return; }
    try {
      if (contentEditId) {
        await api.put(`/admin/content/${contentEditId}`, { title: contentForm.title, content: contentForm.content });
        toast.success('Content updated');
      } else {
        if (!contentForm.slug) { toast.error('Slug is required'); return; }
        await api.post('/admin/content', contentForm);
        toast.success('Content created');
      }
      resetContentForm();
      fetchAllContent();
    } catch (err) { toast.error(err.message || 'Failed'); }
  };

  const handleEditContent = (page) => {
    setContentForm({ slug: page.slug, title: page.title, content: page.content });
    setContentEditId(page.id);
    setShowContentForm(true);
    setActiveTab('pages');
  };

  const handleDeleteContent = async (id) => {
    if (!confirm('Delete this content page?')) return;
    try { await api.delete(`/admin/content/${id}`); toast.success('Content deleted'); fetchAllContent(); }
    catch (err) { toast.error(err.message || 'Failed'); }
  };

  const tabs = ['faq', 'pages'];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Content Management</h2>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white shadow-sm text-secondary' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab === 'faq' ? 'FAQs' : 'Content Pages'}
          </button>
        ))}
      </div>

      {/* ===== FAQs Tab ===== */}
      {activeTab === 'faq' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => { resetFaqForm(); setShowFaqForm(!showFaqForm); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
              {showFaqForm ? <HiX className="w-4 h-4" /> : <HiPlus className="w-4 h-4" />}
              {showFaqForm ? 'Cancel' : 'Add FAQ'}
            </button>
          </div>

          {showFaqForm && (
            <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
              <h3 className="font-semibold mb-4">{faqEditId ? 'Edit FAQ' : 'New FAQ'}</h3>
              <input placeholder="Question" value={faqForm.question} onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm mb-3" />
              <textarea placeholder="Answer" value={faqForm.answer} onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm mb-3" rows={3} />
              <input placeholder="Category (e.g. Orders, Payment, Delivery)" value={faqForm.category} onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm mb-3" />
              <button onClick={handleSaveFaq} className="px-4 py-2 bg-secondary text-white rounded-lg text-sm hover:bg-secondary-dark">
                {faqEditId ? 'Update' : 'Save'} FAQ
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm p-5">
            {faqs.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No FAQs found</p>
            ) : (
              <div className="space-y-3">
                {faqs.map((faq) => (
                  <div key={faq.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{faq.question}</p>
                        <p className="text-sm text-gray-500 mt-1">{faq.answer}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {faq.category && <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs">{faq.category}</span>}
                        <button onClick={() => handleEditFaq(faq)} className="p-1 text-gray-400 hover:text-blue-500"><HiPencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteFaq(faq.id)} className="p-1 text-gray-400 hover:text-red-500"><HiTrash className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Content Pages Tab ===== */}
      {activeTab === 'pages' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => { resetContentForm(); setShowContentForm(!showContentForm); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
              {showContentForm ? <HiX className="w-4 h-4" /> : <HiPlus className="w-4 h-4" />}
              {showContentForm ? 'Cancel' : 'Add Page'}
            </button>
          </div>

          {showContentForm && (
            <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
              <h3 className="font-semibold mb-4">{contentEditId ? 'Edit Content' : 'New Content Page'}</h3>
              {!contentEditId && (
                <input placeholder="Slug (e.g. terms, privacy, about)" value={contentForm.slug} onChange={(e) => setContentForm({ ...contentForm, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} className="w-full px-3 py-2 border rounded-lg text-sm mb-3" />
              )}
              <input placeholder="Title" value={contentForm.title} onChange={(e) => setContentForm({ ...contentForm, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm mb-3" />
              <textarea placeholder="Content" value={contentForm.content} onChange={(e) => setContentForm({ ...contentForm, content: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm mb-3" rows={8} />
              <button onClick={handleSaveContent} className="px-4 py-2 bg-secondary text-white rounded-lg text-sm hover:bg-secondary-dark">
                {contentEditId ? 'Update' : 'Save'} Content
              </button>
            </div>
          )}

          <div className="space-y-4">
            {loading ? (
              <p className="text-gray-400 text-center py-8">Loading...</p>
            ) : contentPages.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No content pages found</p>
            ) : (
              contentPages.map((page) => (
                <div key={page.id || page.slug} className="bg-white rounded-xl shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-800">{page.title}</h3>
                      <p className="text-xs text-gray-400">Slug: {page.slug}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleEditContent(page)} className="p-1.5 text-gray-400 hover:text-blue-500"><HiPencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteContent(page.id)} className="p-1.5 text-gray-400 hover:text-red-500"><HiTrash className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-3">{page.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
