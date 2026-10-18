import { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { HiPlus, HiMinus, HiTrash, HiX, HiOutlinePrinter, HiOutlineSearch, HiOutlineUserCircle, HiCheckCircle, HiOutlineOfficeBuilding } from 'react-icons/hi';
import { TbHanger, TbKeyboard } from 'react-icons/tb';
import InvoicePrint from '../components/InvoicePrint';
import { categoryIcon, itemIcon } from '../components/clothIcons';
import { useLocations } from '../context/LocationContext';

const GARMENT_COLORS = [
  { name: 'White', swatch: '#ffffff' },
  { name: 'Black', swatch: '#111827' },
  { name: 'Blue', swatch: '#2563eb' },
  { name: 'Red', swatch: '#dc2626' },
  { name: 'Green', swatch: '#16a34a' },
  { name: 'Yellow', swatch: '#facc15' },
  { name: 'Pink', swatch: '#f472b6' },
  { name: 'Gray', swatch: '#9ca3af' },
  { name: 'Brown', swatch: '#92400e' },
  { name: 'Navy', swatch: '#1e3a8a' },
  { name: 'Beige', swatch: '#e7d7b8' },
  { name: 'Multi', swatch: 'conic-gradient(#ef4444, #facc15, #22c55e, #3b82f6, #a855f7, #ef4444)' },
];
const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const PAYMENT_METHODS = [
  { value: 'cod', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'wallet', label: 'Pay Later' },
];
const DELIVERY_PRESETS = [
  { label: 'Tomorrow', days: 1 },
  { label: '+2 days', days: 2 },
  { label: '+3 days', days: 3 },
];
const SHORTCUTS = [
  ['F2  or  /', 'Search items'],
  ['Enter', 'Add the first search result'],
  ['1 – 9', 'Add the numbered item'],
  ['Arrows + Enter', 'Move between items and add one'],
  ['[  and  ]', 'Previous / next category'],
  ['+  /  −', 'Quantity of the selected bill line'],
  ['Alt + ↑ / ↓', 'Select another bill line'],
  ['Delete', 'Remove the selected bill line'],
  ['F4', 'Find customer by phone or name'],
  ['Alt + 1 – 4', 'Cash / UPI / Card / Pay Later'],
  ['F9  or  Ctrl + Enter', 'Create order'],
  ['Esc', 'Clear search / close'],
  ['?', 'Show these shortcuts'],
];

// Matches on the name or on word initials ("dc" finds "Door Curtain")
const matchesSearch = (name, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const n = name.toLowerCase();
  const initials = n.split(/[\s-]+/).map(w => w[0]).join('');
  return n.includes(q) || initials.startsWith(q);
};

const isTypingIn = (el) => el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);

const dateAfter = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const inr = (n) => {
  const value = Math.round(n * 100) / 100;
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })}`;
};

function Kbd({ children, className = '', dark = false }) {
  const colors = dark ? 'border-white/30 bg-white/10 text-white' : 'border-gray-300 bg-white text-gray-500';
  return (
    <kbd className={`inline-flex items-center justify-center min-w-[1.25rem] px-1 py-0.5 rounded border text-[10px] font-mono font-semibold leading-none ${colors} ${className}`}>
      {children}
    </kbd>
  );
}

function ItemVisual({ item, small = false }) {
  const [broken, setBroken] = useState(false);
  const box = small ? 'w-9 h-9 rounded-lg' : 'w-16 h-16 rounded-2xl';
  if (item.imageUrl && !broken) {
    return <img src={item.imageUrl} alt="" onError={() => setBroken(true)} className={`${box} object-cover bg-gray-50 flex-shrink-0`} />;
  }
  // No image: the item's chosen icon, else one guessed from its name or category
  const Icon = itemIcon(item);
  return (
    <div className={`${box} bg-primary/15 text-secondary flex items-center justify-center flex-shrink-0`}>
      <Icon className={small ? 'w-5 h-5' : 'w-9 h-9'} />
    </div>
  );
}

/** Receipt header: the store's own address, phone and GSTIN over the business-wide GST settings */
const receiptSettings = (gst, store) => {
  if (!store) return gst;
  const address = [store.addressLine, store.city, store.pincode].filter(Boolean).join(', ');
  return {
    ...gst,
    businessName: gst?.businessName ? `${gst.businessName} - ${store.name}` : store.name,
    businessAddress: address || gst?.businessAddress,
    businessPhone: store.phone || gst?.businessPhone,
    gstin: store.gstin || gst?.gstin,
  };
};

export default function PosPage() {
  // Bills belong to a store: the manager's own, or the one the admin picked in the header
  const { locations, selectedId: storeId, current: store, isManager, setSelectedId } = useLocations();
  const [step, setStep] = useState('order'); // order | success

  // Catalogue
  const [categories, setCategories] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [activeCat, setActiveCat] = useState('all');
  const [activeSub, setActiveSub] = useState('all');
  const [search, setSearch] = useState('');
  const [flashId, setFlashId] = useState(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customForm, setCustomForm] = useState({ name: '', price: '', quantity: '1' });

  // Customer
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [activeResult, setActiveResult] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  // Bill
  const [lines, setLines] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null);

  // Payment
  const [discount, setDiscount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [paymentDetail, setPaymentDetail] = useState('Cash');
  const [expectedDelivery, setExpectedDelivery] = useState('');

  // Result
  const [createdOrder, setCreatedOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gstSettings, setGstSettings] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  const searchRef = useRef(null);
  const customerRef = useRef(null);
  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const gridRef = useRef(null);
  const customNameRef = useRef(null);
  const billRef = useRef(null);
  const lineKey = useRef(0);

  useEffect(() => { fetchGst(); }, []);
  useEffect(() => { if (storeId) fetchCatalogue(); }, [storeId]);

  const fetchCatalogue = async () => {
    setCatalogueLoading(true);
    try {
      const res = await api.get('/categories');
      const cats = res.data || [];
      setCategories(cats);
      const perCategory = await Promise.all(cats.map(async (c) => {
        try {
          // The store's own prices; items it doesn't offer are left out
          const r = await api.get(`/categories/${c.id}/items`, { params: { limit: 200, locationId: storeId } });
          return (r.data?.items || []).map(i => ({
            ...i,
            price: parseFloat(i.price),
            categoryId: c.id,
            categoryIcon: c.icon,
            subCategoryId: i.subCategoryId || i.subCategory?.id || null,
          }));
        } catch (err) { return []; }
      }));
      setAllItems(perCategory.flat());
    } catch (err) {
      toast.error('Could not load items');
    } finally {
      setCatalogueLoading(false);
    }
  };

  const fetchGst = async () => {
    try {
      const res = await api.get('/admin/gst');
      setGstSettings(res.data || null);
    } catch (err) { /* ignore */ }
  };

  // ===== Catalogue =====
  const categoryTabs = useMemo(() => [{ id: 'all', name: 'All' }, ...categories], [categories]);
  const activeCategory = categories.find(c => c.id === activeCat);
  const subTabs = useMemo(() => {
    const subs = activeCategory?.subCategories || [];
    return subs.filter(s => allItems.some(i => i.subCategoryId === s.id));
  }, [activeCategory, allItems]);

  const visibleItems = useMemo(() => {
    if (search.trim()) return allItems.filter(i => matchesSearch(i.name, search));
    return allItems.filter(i =>
      (activeCat === 'all' || i.categoryId === activeCat)
      && (activeSub === 'all' || i.subCategoryId === activeSub));
  }, [allItems, search, activeCat, activeSub]);

  const qtyInBill = useMemo(() => {
    const map = {};
    lines.forEach(l => { if (l.itemId) map[l.itemId] = (map[l.itemId] || 0) + l.quantity; });
    return map;
  }, [lines]);

  const switchCategory = (id) => {
    setActiveCat(id);
    setActiveSub('all');
    setSearch('');
  };

  const stepCategory = (delta) => {
    const idx = categoryTabs.findIndex(c => c.id === activeCat);
    const next = categoryTabs[(idx + delta + categoryTabs.length) % categoryTabs.length];
    if (next) switchCategory(next.id);
  };

  // ===== Bill =====
  const addToBill = (item) => {
    // Same item without colour/size/note goes onto the existing line
    const plain = lines.find(l => l.itemId === item.id && l.price === item.price && !l.garmentColor && !l.size && !l.itemNote);
    if (plain) {
      setLines(lines.map(l => (l.key === plain.key ? { ...l, quantity: l.quantity + 1 } : l)));
      setSelectedKey(plain.key);
    } else {
      const key = ++lineKey.current;
      setLines([...lines, {
        key,
        itemId: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        garmentColor: '',
        size: '',
        itemNote: '',
        imageUrl: item.imageUrl,
        icon: item.icon,
        categoryIcon: item.categoryIcon,
      }]);
      setSelectedKey(key);
    }
    setFlashId(item.id);
    setTimeout(() => setFlashId(current => (current === item.id ? null : current)), 250);
  };

  const addCustomItem = () => {
    const price = parseFloat(customForm.price);
    if (!customForm.name.trim() || !(price > 0)) { toast.error('Item name and price are required'); return; }
    const key = ++lineKey.current;
    setLines([...lines, {
      key,
      itemId: null,
      name: customForm.name.trim(),
      price,
      quantity: Math.max(1, parseInt(customForm.quantity) || 1),
      garmentColor: '',
      size: '',
      itemNote: '',
    }]);
    setSelectedKey(key);
    setCustomForm({ name: '', price: '', quantity: '1' });
    setShowCustom(false);
  };

  const openCustomItem = (name = '') => {
    setCustomForm({ name, price: '', quantity: '1' });
    setShowCustom(true);
    setTimeout(() => customNameRef.current?.focus(), 0);
  };

  const updateLine = (key, changes) => setLines(lines.map(l => (l.key === key ? { ...l, ...changes } : l)));

  const removeLine = (key) => {
    const idx = lines.findIndex(l => l.key === key);
    const rest = lines.filter(l => l.key !== key);
    setLines(rest);
    if (expandedKey === key) setExpandedKey(null);
    if (selectedKey === key) setSelectedKey(rest[Math.min(idx, rest.length - 1)]?.key ?? null);
  };

  const changeQty = (key, delta) => {
    const line = lines.find(l => l.key === key);
    if (!line) return;
    if (line.quantity + delta < 1) removeLine(key);
    else updateLine(key, { quantity: line.quantity + delta });
  };

  const moveSelection = (delta) => {
    if (lines.length === 0) return;
    const idx = lines.findIndex(l => l.key === selectedKey);
    const next = idx < 0 ? lines.length - 1 : Math.max(0, Math.min(lines.length - 1, idx + delta));
    setSelectedKey(lines[next].key);
  };

  const clearBill = () => {
    if (lines.length && !window.confirm('Remove all items from this bill?')) return;
    setLines([]);
    setSelectedKey(null);
    setExpandedKey(null);
  };

  // ===== Customer =====
  useEffect(() => {
    const q = customerQuery.trim();
    if (q.length < 3) { setCustomerResults([]); return undefined; }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/admin/users', { params: { search: q, limit: 5 } });
        setCustomerResults(res.data?.users || []);
        setActiveResult(0);
      } catch (err) { setCustomerResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  const selectCustomer = (user) => {
    setCustomerName(user.name || '');
    setCustomerPhone((user.phone || '').replace(/\D/g, '').slice(-10));
    setSelectedCustomerId(user.id);
    setCustomerResults([]);
    setCustomerQuery('');
    // Leave the input so the item shortcuts (1-9) work straight away
    if (user.name) customerRef.current?.blur();
    else setTimeout(() => nameRef.current?.focus(), 0);
  };

  const onCustomerKeyDown = (e) => {
    if (e.key === 'ArrowDown' && customerResults.length) {
      e.preventDefault();
      setActiveResult((activeResult + 1) % customerResults.length);
    } else if (e.key === 'ArrowUp' && customerResults.length) {
      e.preventDefault();
      setActiveResult((activeResult - 1 + customerResults.length) % customerResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (customerResults[activeResult]) { selectCustomer(customerResults[activeResult]); return; }
      // New customer: a phone number goes to Phone, anything else to Name
      const q = customerQuery.trim();
      if (!q) return;
      setSelectedCustomerId(null);
      if (/^\+?[\d\s-]{10,}$/.test(q)) {
        setCustomerPhone(q.replace(/\D/g, '').slice(-10));
        setTimeout(() => nameRef.current?.focus(), 0);
      } else {
        setCustomerName(q);
        setTimeout(() => phoneRef.current?.focus(), 0);
      }
      setCustomerQuery('');
    }
  };

  // ===== Totals (same GST rules as the order API) =====
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const discountAmt = Math.min(Math.max(parseFloat(discount) || 0, 0), subtotal);
  const afterDiscount = subtotal - discountAmt;
  const gstRate = gstSettings?.isEnabled ? parseFloat(gstSettings.gstRate) || 0 : 0;
  const gstExclusive = gstSettings?.gstType === 'exclusive';
  const gstAmount = gstRate > 0
    ? (gstExclusive ? afterDiscount * gstRate / 100 : afterDiscount - (afterDiscount * 100 / (100 + gstRate)))
    : 0;
  const total = gstExclusive ? afterDiscount + gstAmount : afterDiscount;

  const choosePayment = (pm) => { setPaymentMethod(pm.value); setPaymentDetail(pm.label); };

  const handleCreateOrder = async () => {
    if (loading) return;
    if (lines.length === 0) { toast.error('Add at least one item'); searchRef.current?.focus(); return; }
    if (!customerName.trim() || !customerPhone) {
      toast.error('Customer name and phone are required');
      (customerPhone ? nameRef : customerRef).current?.focus();
      return;
    }
    if (customerPhone.length < 10) { toast.error('Enter valid 10-digit phone'); phoneRef.current?.focus(); return; }

    setLoading(true);
    try {
      const payload = {
        locationId: storeId,
        customerName: customerName.trim(),
        customerPhone,
        customerNote,
        items: lines.map(l => ({
          itemId: l.itemId,
          name: l.name,
          quantity: l.quantity,
          price: l.price,
          size: l.size,
          garmentColor: l.garmentColor,
          itemNote: l.itemNote,
        })),
        discount: discountAmt,
        paymentMethod,
        paymentMethodDetail: paymentDetail,
        paymentStatus: paymentMethod === 'wallet' ? 'pending' : 'paid',
        expectedDeliveryDate: expectedDelivery || null,
      };

      const res = await api.post('/admin/pos/create-order', payload);
      setCreatedOrder(res.data);
      setStep('success');
      toast.success('Order created!');
    } catch (err) {
      toast.error(err.message || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const resetOrder = () => {
    setCustomerName(''); setCustomerPhone(''); setCustomerNote(''); setShowNote(false);
    setCustomerQuery(''); setCustomerResults([]); setSelectedCustomerId(null);
    setLines([]); setSelectedKey(null); setExpandedKey(null);
    setDiscount(''); setPaymentMethod('cod'); setPaymentDetail('Cash');
    setExpectedDelivery(''); setCreatedOrder(null); setStep('order');
    setSearch('');
  };

  // ===== Keyboard =====
  const onSearchKeyDown = (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (visibleItems[0]) {
        addToBill(visibleItems[0]);
        e.currentTarget.select();
      } else if (search.trim()) {
        openCustomItem(search.trim());
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      gridRef.current?.querySelector('[data-tile]')?.focus();
    }
  };

  const onGridKeyDown = (e) => {
    const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 'down', ArrowUp: 'up' };
    if (!(e.key in moves) || e.altKey) return;
    const tiles = [...gridRef.current.querySelectorAll('[data-tile]')];
    const idx = tiles.indexOf(document.activeElement);
    if (idx < 0) return;
    const cols = getComputedStyle(gridRef.current).gridTemplateColumns.split(' ').length;
    const move = moves[e.key];
    const delta = move === 'down' ? cols : move === 'up' ? -cols : move;
    e.preventDefault();
    if (tiles[idx + delta]) tiles[idx + delta].focus();
    else if (move === 'up') searchRef.current?.focus();
  };

  const keyHandler = useRef(null);
  keyHandler.current = (e) => {
    if (!storeId) return; // still choosing a store
    const typing = isTypingIn(e.target);
    const lower = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    if (step === 'success') {
      // Enter on a focused button is that button's own click
      if (typing || e.ctrlKey || e.metaKey || e.altKey || (e.key === 'Enter' && e.target.tagName === 'BUTTON')) return;
      if (e.key === 'Enter' || lower === 'n' || e.key === 'F9') { e.preventDefault(); resetOrder(); }
      else if (lower === 'p') { e.preventDefault(); window.print(); }
      return;
    }

    if (showHelp) {
      if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); setShowHelp(false); }
      return;
    }

    if (e.key === 'F2' || (e.key === '/' && !typing)) {
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
      return;
    }
    if (e.key === 'F4') { e.preventDefault(); customerRef.current?.focus(); return; }
    if (e.key === 'F9' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); handleCreateOrder(); return; }

    // e.code keeps Alt+digit working on layouts where Alt changes e.key (e.g. Option on Mac)
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code) || /^([1-9])$/.exec(e.key);
    if (e.altKey && !e.ctrlKey && digit && Number(digit[1]) <= PAYMENT_METHODS.length) {
      e.preventDefault();
      choosePayment(PAYMENT_METHODS[Number(digit[1]) - 1]);
      return;
    }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      moveSelection(e.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    if (e.key === 'Escape') {
      if (showCustom) setShowCustom(false);
      else if (customerResults.length) setCustomerResults([]);
      else if (search) setSearch('');
      else if (typing) e.target.blur();
      return;
    }

    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === '?') { e.preventDefault(); setShowHelp(true); return; }
    if (digit && !e.shiftKey) {
      const item = visibleItems[Number(digit[1]) - 1];
      if (item) { e.preventDefault(); addToBill(item); }
      return;
    }
    if (e.key === '[' || e.key === ']') { e.preventDefault(); stepCategory(e.key === '[' ? -1 : 1); return; }
    if (selectedKey !== null) {
      if (e.key === '+' || e.key === '=') { e.preventDefault(); changeQty(selectedKey, 1); return; }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); changeQty(selectedKey, -1); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeLine(selectedKey); }
    }
  };

  useEffect(() => {
    const onKeyDown = (e) => keyHandler.current?.(e);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ===== SUCCESS SCREEN =====
  if (step === 'success' && createdOrder) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-6 text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <HiCheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Order Created Successfully!</h2>
          <p className="text-gray-500 mt-1">Invoice: <span className="font-mono font-bold">{createdOrder.booking?.invoiceNumber || createdOrder.invoiceNumber}</span></p>
          <p className="text-gray-500">Order: <span className="font-mono">{createdOrder.booking?.orderNumber}</span></p>
          <p className="text-2xl font-bold text-secondary mt-3">₹{createdOrder.booking?.total}</p>
        </div>

        {/* Barcodes */}
        {createdOrder.barcodes?.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="font-semibold mb-3">Barcode Labels</h3>
            <div className="space-y-2">
              {createdOrder.barcodes.map((b, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                  <div>
                    <span className="font-medium">{b.name}</span>
                    {b.garmentColor && <span className="ml-2 text-xs text-gray-400">({b.garmentColor})</span>}
                  </div>
                  <span className="font-mono text-xs bg-white px-2 py-1 rounded border">{b.barcode}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-2 py-3 bg-secondary text-white rounded-xl font-medium hover:bg-secondary-dark">
            <HiOutlinePrinter className="w-5 h-5" /> Print Receipt & Labels <Kbd dark className="ml-1">P</Kbd>
          </button>
          <button onClick={resetOrder} className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark">
            New Order <Kbd dark className="ml-1">Enter</Kbd>
          </button>
        </div>

        {/* Hidden print content - only visible when printing */}
        <InvoicePrint order={createdOrder} gstSettings={receiptSettings(gstSettings, createdOrder.location || store)} />
      </div>
    );
  }

  // ===== STORE PICKER (admin viewing all locations) =====
  if (!storeId) {
    const active = locations.filter(l => l.isActive);
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-800">Which store are you billing for?</h2>
          <p className="text-sm text-gray-500 mt-1">The bill uses that store's prices and invoice numbers. You can change store from the header at any time.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            {active.map(l => (
              <button
                key={l.id}
                onClick={() => setSelectedId(l.id)}
                className="flex items-center gap-3 text-left p-4 border rounded-xl hover:border-primary hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
              >
                <span className="w-11 h-11 rounded-xl bg-primary/15 text-secondary flex items-center justify-center flex-shrink-0"><HiOutlineOfficeBuilding className="w-6 h-6" /></span>
                <span className="min-w-0">
                  <span className="block font-semibold text-gray-800 truncate">{l.name}</span>
                  <span className="block text-xs text-gray-500 truncate">{[l.code, l.city].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            ))}
            {active.length === 0 && <p className="text-sm text-gray-400">No active stores. Add one on the Locations page.</p>}
          </div>
        </div>
      </div>
    );
  }

  // ===== BILLING SCREEN =====
  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-6.5rem)]">
      {/* Left: item catalogue */}
      <section className="flex-1 min-w-0 flex flex-col bg-white rounded-xl shadow-sm lg:min-h-0">
        <div className="p-4 pb-3 border-b space-y-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-800 whitespace-nowrap leading-tight">POS Billing</h2>
              <p className="text-xs text-gray-500 truncate flex items-center gap-1" title="Store for this bill">
                <HiOutlineOfficeBuilding className="w-3.5 h-3.5 flex-shrink-0" />{store?.name || 'Store'}
                {!isManager && <button onClick={() => setSelectedId(null)} className="ml-1 text-secondary hover:underline">Change</button>}
              </p>
            </div>
            <div className="relative flex-1">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchRef}
                placeholder="Search items, e.g. shirt or dc for Door Curtain"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onSearchKeyDown}
                className="w-full pl-9 pr-20 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {search ? (
                  <button onClick={() => { setSearch(''); searchRef.current?.focus(); }} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Clear search">
                    <HiX className="w-4 h-4" />
                  </button>
                ) : <Kbd>F2</Kbd>}
              </div>
            </div>
            <button
              onClick={() => setShowHelp(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              title="Keyboard shortcuts"
            >
              <TbKeyboard className="w-4 h-4" /><span className="hidden xl:inline">Shortcuts</span><Kbd>?</Kbd>
            </button>
          </div>

          {/* Category tabs */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {categoryTabs.map((c) => {
              const Icon = c.id === 'all' ? TbHanger : categoryIcon(c.icon);
              const count = c.id === 'all' ? allItems.length : allItems.filter(i => i.categoryId === c.id).length;
              const active = !search && activeCat === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => switchCategory(c.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${active ? 'bg-secondary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  <Icon className="w-4 h-4" />
                  {c.name}
                  <span className={`text-xs ${active ? 'text-white/70' : 'text-gray-400'}`}>{count}</span>
                </button>
              );
            })}
            <span className="hidden lg:flex items-center gap-1 ml-auto pl-2 text-xs text-gray-400 whitespace-nowrap"><Kbd>[</Kbd><Kbd>]</Kbd> switch</span>
          </div>

          {/* Sub-category chips */}
          {!search && subTabs.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto">
              {[{ id: 'all', name: 'All' }, ...subTabs].map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSub(s.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${activeSub === s.id ? 'border-primary bg-primary/10 text-secondary' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Custom item */}
        {showCustom && (
          <div className="mx-4 mt-3 p-3 border border-dashed border-primary rounded-lg bg-primary/5">
            <div className="flex flex-wrap items-center gap-2" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomItem(); } }}>
              <input ref={customNameRef} placeholder="Item name *" value={customForm.name} onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })} className="flex-1 min-w-[10rem] px-3 py-2 border rounded-lg text-sm bg-white" />
              <input placeholder="Price ₹ *" type="number" min="0" value={customForm.price} onChange={(e) => setCustomForm({ ...customForm, price: e.target.value })} className="w-28 px-3 py-2 border rounded-lg text-sm bg-white" />
              <input placeholder="Qty" type="number" min="1" value={customForm.quantity} onChange={(e) => setCustomForm({ ...customForm, quantity: e.target.value })} className="w-20 px-3 py-2 border rounded-lg text-sm bg-white" />
              <button onClick={addCustomItem} className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium">Add</button>
              <button onClick={() => setShowCustom(false)} className="px-3 py-2 text-sm text-gray-500">Cancel</button>
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              Adds to this bill only.
              {!isManager && (
                <>
                  {' '}Billing it often?{' '}
                  <a
                    href={`/catalogue?new=1&name=${encodeURIComponent(customForm.name.trim())}${activeCat !== 'all' ? `&categoryId=${activeCat}` : ''}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-secondary font-medium hover:underline"
                  >
                    Add it to the catalogue with an icon
                  </a>
                  {' '}(opens in a new tab; reload POS afterwards to see it here).
                </>
              )}
            </p>
          </div>
        )}

        {/* Item grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {search && (
            <p className="text-xs text-gray-400 mb-3">
              {visibleItems.length} result{visibleItems.length === 1 ? '' : 's'} for “{search}” · <Kbd>Enter</Kbd> adds the first
            </p>
          )}
          {catalogueLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-40 rounded-xl bg-gray-100 animate-pulse" />)}
            </div>
          ) : (
            <div ref={gridRef} onKeyDown={onGridKeyDown} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {visibleItems.map((item, index) => {
                const qty = qtyInBill[item.id] || 0;
                return (
                  <button
                    key={item.id}
                    data-tile
                    type="button"
                    onClick={() => addToBill(item)}
                    title={`Add ${item.name}`}
                    className={`group relative flex flex-col items-center text-center rounded-xl border bg-white p-3 pt-5 transition-all hover:border-primary hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${qty ? 'border-primary/60' : 'border-gray-200'} ${flashId === item.id ? 'scale-95 ring-2 ring-primary' : ''}`}
                  >
                    {index < 9 && <Kbd className="absolute top-2 left-2">{index + 1}</Kbd>}
                    {qty > 0 && (
                      <span className="absolute top-2 right-2 min-w-[1.5rem] h-6 px-1.5 rounded-full bg-secondary text-white text-xs font-bold flex items-center justify-center">
                        {qty}
                      </span>
                    )}
                    <ItemVisual item={item} />
                    <p className="mt-2 text-sm font-medium text-gray-800 leading-tight line-clamp-2">{item.name}</p>
                    <p className="text-[11px] text-gray-400 h-4">{search ? categories.find(c => c.id === item.categoryId)?.name : item.subCategory?.name}</p>
                    <div className="mt-2 w-full flex items-center justify-between">
                      <span className="text-sm font-bold text-secondary">{inr(item.price)}</span>
                      <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-sm group-hover:bg-secondary transition-colors">
                        <HiPlus className="w-4 h-4" />
                      </span>
                    </div>
                  </button>
                );
              })}

              <button
                data-tile
                type="button"
                onClick={() => openCustomItem(search.trim())}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-3 min-h-[10rem] text-gray-400 hover:border-primary hover:text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
              >
                <span className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"><HiPlus className="w-5 h-5" /></span>
                <span className="text-sm font-medium">Custom item</span>
                <span className="text-[11px]">Not in the list</span>
              </button>
            </div>
          )}
          {!catalogueLoading && search && visibleItems.length === 0 && (
            <p className="text-sm text-gray-400 text-center mt-4">No items match “{search}”. Press <Kbd>Enter</Kbd> to add it as a custom item.</p>
          )}
        </div>
      </section>

      {/* Right: bill */}
      <aside ref={billRef} className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 flex flex-col bg-white rounded-xl shadow-sm lg:min-h-0 lg:overflow-y-auto">
        {/* Customer */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><HiOutlineUserCircle className="w-4 h-4" /> Customer</h3>
            {selectedCustomerId && <span className="text-[11px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Registered user</span>}
          </div>
          <div className="relative">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={customerRef}
              placeholder="Find by phone or name"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              onKeyDown={onCustomerKeyDown}
              className="w-full pl-9 pr-10 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
            <Kbd className="absolute right-2 top-1/2 -translate-y-1/2">F4</Kbd>
            {customerResults.length > 0 && (
              <ul className="absolute z-10 left-0 right-0 mt-1 border rounded-lg bg-white shadow-lg overflow-hidden">
                {customerResults.map((u, i) => (
                  <li key={u.id}>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); selectCustomer(u); }}
                      onMouseEnter={() => setActiveResult(i)}
                      className={`w-full text-left px-3 py-2 text-sm border-b last:border-0 ${i === activeResult ? 'bg-primary/10' : ''}`}
                    >
                      <span className="font-medium">{u.name || 'Unnamed'}</span>
                      <span className="text-gray-500 ml-2">{u.phone}</span>
                      {u.email && <span className="block text-xs text-gray-400 truncate">{u.email}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <input ref={nameRef} placeholder="Name *" value={customerName} onChange={(e) => { setCustomerName(e.target.value); setSelectedCustomerId(null); }} className="px-3 py-2 border rounded-lg text-sm" />
            <input ref={phoneRef} placeholder="Phone (10 digits) *" inputMode="numeric" value={customerPhone} onChange={(e) => { setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setSelectedCustomerId(null); }} className="px-3 py-2 border rounded-lg text-sm" />
          </div>
          {showNote || customerNote ? (
            <textarea autoFocus={showNote && !customerNote} placeholder="Customer note (optional)" value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} className="w-full mt-2 px-3 py-2 border rounded-lg text-sm" rows={2} />
          ) : (
            <button onClick={() => setShowNote(true)} className="mt-2 text-xs text-secondary hover:underline">+ Add customer note</button>
          )}
        </div>

        {/* Bill lines */}
        <div className="flex-1 flex flex-col min-h-[12rem] lg:min-h-[10rem]">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <h3 className="text-sm font-semibold text-gray-700">Bill <span className="text-gray-400 font-normal">· {itemCount} item{itemCount === 1 ? '' : 's'}</span></h3>
            {lines.length > 0 && <button onClick={clearBill} className="text-xs text-red-500 hover:underline">Clear</button>}
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-3">
            {lines.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-6">
                <TbHanger className="w-10 h-10 mb-2 text-gray-300" />
                <p className="text-sm">No items yet</p>
                <p className="text-xs mt-1">Tap an item or press <Kbd>1</Kbd>–<Kbd>9</Kbd></p>
              </div>
            ) : (
              <ul className="space-y-2">
                {lines.map((l) => {
                  const selected = l.key === selectedKey;
                  const expanded = l.key === expandedKey;
                  const color = GARMENT_COLORS.find(c => c.name === l.garmentColor);
                  return (
                    <li
                      key={l.key}
                      onClick={() => setSelectedKey(l.key)}
                      className={`rounded-lg border px-2.5 py-2 cursor-pointer transition-colors ${selected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className="flex items-center gap-2">
                        <ItemVisual item={l} small />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{l.name}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1.5">
                            {inr(l.price)} each
                            {color && <span className="inline-block w-2.5 h-2.5 rounded-full border border-gray-300" style={{ background: color.swatch }} title={color.name} />}
                            {l.size && <span>· {l.size}</span>}
                          </p>
                        </div>
                        <div className="flex items-center rounded-lg border bg-white">
                          <button onClick={(e) => { e.stopPropagation(); changeQty(l.key, -1); }} className="p-1.5 text-gray-500 hover:text-red-500" aria-label="Decrease quantity"><HiMinus className="w-3.5 h-3.5" /></button>
                          <span className="w-7 text-center text-sm font-semibold">{l.quantity}</span>
                          <button onClick={(e) => { e.stopPropagation(); changeQty(l.key, 1); }} className="p-1.5 text-gray-500 hover:text-secondary" aria-label="Increase quantity"><HiPlus className="w-3.5 h-3.5" /></button>
                        </div>
                        <span className="w-16 text-right text-sm font-semibold text-gray-800">{inr(l.price * l.quantity)}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 pl-11 text-xs">
                        <button onClick={(e) => { e.stopPropagation(); setExpandedKey(expanded ? null : l.key); setSelectedKey(l.key); }} className="text-secondary hover:underline">
                          {expanded ? 'Done' : 'Colour, size, note'}
                        </button>
                        {l.itemNote && !expanded && <span className="text-orange-500 truncate">⚠ {l.itemNote}</span>}
                        <button onClick={(e) => { e.stopPropagation(); removeLine(l.key); }} className="ml-auto p-0.5 text-gray-300 hover:text-red-500" aria-label="Remove item"><HiTrash className="w-4 h-4" /></button>
                      </div>
                      {expanded && (
                        <div className="mt-2 pl-11 space-y-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap gap-1.5">
                            {GARMENT_COLORS.map(c => (
                              <button
                                key={c.name}
                                title={c.name}
                                aria-label={c.name}
                                onClick={() => updateLine(l.key, { garmentColor: l.garmentColor === c.name ? '' : c.name })}
                                className={`w-6 h-6 rounded-full border ${l.garmentColor === c.name ? 'ring-2 ring-offset-1 ring-secondary border-secondary' : 'border-gray-300'}`}
                                style={{ background: c.swatch }}
                              />
                            ))}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {SIZES.map(s => (
                              <button
                                key={s}
                                onClick={() => updateLine(l.key, { size: l.size === s ? '' : s })}
                                className={`px-2 py-1 rounded text-xs font-medium border ${l.size === s ? 'border-secondary bg-secondary text-white' : 'border-gray-200 text-gray-600'}`}
                              >
                                {s}
                              </button>
                            ))}
                            <label className="ml-auto flex items-center gap-1 text-xs text-gray-500">
                              ₹
                              <input
                                type="number"
                                min="0"
                                value={l.price}
                                onChange={(e) => updateLine(l.key, { price: Math.max(0, parseFloat(e.target.value) || 0) })}
                                className="w-16 px-2 py-1 border rounded text-xs"
                                aria-label="Unit price"
                              />
                            </label>
                          </div>
                          <input
                            placeholder="Note: stain, missing button, stitching..."
                            value={l.itemNote}
                            onChange={(e) => updateLine(l.key, { itemNote: e.target.value })}
                            className="w-full px-2.5 py-1.5 border rounded text-xs"
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Totals + payment */}
        <div className="border-t p-4 space-y-3 bg-gray-50/60 rounded-b-xl">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{inr(subtotal)}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Discount</span>
              <div className="flex items-center gap-1">
                <span className="text-gray-400">− ₹</span>
                <input type="number" min="0" placeholder="0" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-20 px-2 py-1 border rounded text-sm text-right bg-white" />
              </div>
            </div>
            {gstRate > 0 ? (
              <div className="flex justify-between text-gray-500">
                <span>GST {gstRate}% <span className="text-xs text-gray-400">({gstExclusive ? 'extra' : 'incl.'} · CGST {inr(gstAmount / 2)} + SGST {inr(gstAmount / 2)})</span></span>
                <span>{inr(gstAmount)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-gray-400 text-xs"><span>GST</span><span>{gstSettings?.isEnabled ? '0%' : 'Disabled'}</span></div>
            )}
            <div className="flex justify-between items-baseline pt-1.5 border-t">
              <span className="font-semibold text-gray-800">Total</span>
              <span className="text-2xl font-bold text-secondary">{inr(total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {PAYMENT_METHODS.map((pm, i) => (
              <button
                key={pm.value}
                onClick={() => choosePayment(pm)}
                title={`Alt + ${i + 1}`}
                className={`flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg text-xs font-semibold border-2 transition-colors ${paymentMethod === pm.value ? 'border-secondary bg-secondary text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                {pm.label}
                <span className={`text-[9px] font-mono font-normal ${paymentMethod === pm.value ? 'text-white/70' : 'text-gray-400'}`}>Alt+{i + 1}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Payment ref (e.g. UPI - PhonePe)" value={paymentDetail} onChange={(e) => setPaymentDetail(e.target.value)} className="px-2.5 py-2 border rounded-lg text-xs bg-white" />
            <input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} className="px-2.5 py-2 border rounded-lg text-xs bg-white" title="Expected delivery" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 mr-1">Delivery</span>
            {DELIVERY_PRESETS.map(p => {
              const value = dateAfter(p.days);
              return (
                <button
                  key={p.days}
                  onClick={() => setExpectedDelivery(expectedDelivery === value ? '' : value)}
                  className={`px-2.5 py-1 rounded-full text-xs border ${expectedDelivery === value ? 'border-secondary bg-secondary/10 text-secondary font-medium' : 'border-gray-200 bg-white text-gray-500'}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleCreateOrder}
            disabled={loading || lines.length === 0}
            className="w-full flex items-center justify-between px-4 py-3.5 bg-secondary text-white rounded-xl font-bold text-sm hover:bg-secondary-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{loading ? 'Creating…' : `Create Order · ${itemCount} item${itemCount === 1 ? '' : 's'}`}</span>
            <span className="flex items-center gap-2">{inr(total)}<Kbd dark>F9</Kbd></span>
          </button>
        </div>
      </aside>

      {/* Tablet / phone: the bill sits below the items, so keep the total in view */}
      {lines.length > 0 && (
        <div className="lg:hidden sticky bottom-0 z-10 -mx-4 px-4 py-3 bg-white/95 backdrop-blur border-t shadow-[0_-4px_12px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-gray-500">{itemCount} item{itemCount === 1 ? '' : 's'}</p>
            <p className="text-lg font-bold text-secondary leading-tight">{inr(total)}</p>
          </div>
          <button onClick={() => billRef.current?.scrollIntoView({ behavior: 'smooth' })} className="px-4 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold">
            View bill
          </button>
        </div>
      )}

      {/* Shortcut help */}
      {showHelp && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2"><TbKeyboard className="w-5 h-5" /> Keyboard shortcuts</h3>
              <button onClick={() => setShowHelp(false)} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Close"><HiX className="w-5 h-5" /></button>
            </div>
            <dl className="divide-y">
              {SHORTCUTS.map(([keys, action]) => (
                <div key={keys} className="flex items-center justify-between py-2 text-sm">
                  <dt className="text-gray-600">{action}</dt>
                  <dd><Kbd className="text-[11px] px-1.5 py-1">{keys}</Kbd></dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
