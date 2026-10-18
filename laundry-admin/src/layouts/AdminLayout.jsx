import { useState } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { HiOutlineHome, HiOutlineClipboardList, HiOutlineUsers, HiOutlineTag, HiOutlineCreditCard, HiOutlineStar, HiOutlineGift, HiOutlineLocationMarker, HiOutlineDocumentText, HiOutlineLogout, HiOutlineMenu, HiOutlineX, HiOutlineCollection, HiOutlineRefresh, HiOutlineIdentification, HiOutlineCurrencyRupee, HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlinePlus, HiOutlineCog, HiOutlineOfficeBuilding } from 'react-icons/hi';
import { LocationProvider, useLocations } from '../context/LocationContext';
import logoWordmark from '../assets/brand/logo_wordmark.png';
import logoMark from '../assets/brand/logo_mark.png';

// managerToo: also shown to branch managers (everything else is admin-only)
const navSections = [
  { title: 'Operations', items: [
    { path: '/', label: 'Dashboard', icon: HiOutlineHome, managerToo: true },
    { path: '/orders', label: 'Orders', icon: HiOutlineClipboardList, managerToo: true },
    { path: '/order-status', label: 'Order Status', icon: HiOutlineRefresh, managerToo: true },
    { path: '/delivery-boys', label: 'Delivery Boys', icon: HiOutlineIdentification, managerToo: true },
  ]},
  { title: 'Customers', items: [
    { path: '/users', label: 'Users', icon: HiOutlineUsers },
    { path: '/wallet-credits', label: 'Wallet Credits', icon: HiOutlineCurrencyRupee },
  ]},
  { title: 'Catalogue', items: [
    { path: '/categories', label: 'Categories', icon: HiOutlineTag },
    { path: '/catalogue', label: 'Items', icon: HiOutlineCollection },
  ]},
  { title: 'Business', items: [
    { path: '/locations', label: 'Locations', icon: HiOutlineOfficeBuilding },
    { path: '/wallet-packages', label: 'Wallet Packages', icon: HiOutlineCreditCard },
    { path: '/subscriptions', label: 'Subscriptions', icon: HiOutlineStar },
    { path: '/promo-codes', label: 'Promo Codes', icon: HiOutlineGift },
    { path: '/pincodes', label: 'Serviceable Areas', icon: HiOutlineLocationMarker },
  ]},
  { title: 'Settings', items: [
    { path: '/gst-settings', label: 'GST & Invoice', icon: HiOutlineCog },
    { path: '/content', label: 'Content & FAQ', icon: HiOutlineDocumentText },
  ]},
];

export default function AdminLayout() {
  const auth = useAuth();
  return (
    <LocationProvider user={auth.user}>
      <LayoutShell auth={auth} />
    </LocationProvider>
  );
}

/** Admins pick a store (or all); branch managers see their own store's name */
function LocationSwitcher() {
  const { locations, selectedId, setSelectedId, current, isManager } = useLocations();
  if (isManager) {
    return (
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-secondary text-sm font-medium">
        <HiOutlineOfficeBuilding className="w-4 h-4" />{current?.name || 'My store'}
      </span>
    );
  }
  if (locations.length === 0) return null;
  return (
    <label className="flex items-center gap-1.5 text-sm text-gray-500">
      <HiOutlineOfficeBuilding className="w-4 h-4 hidden sm:block" />
      <select
        value={selectedId || ''}
        onChange={(e) => setSelectedId(e.target.value || null)}
        className={`max-w-[11rem] sm:max-w-none px-2.5 py-1.5 border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 ${selectedId ? 'border-primary bg-primary/10 text-secondary' : 'text-gray-700'}`}
        aria-label="Location"
      >
        <option value="">All locations</option>
        {locations.map(l => <option key={l.id} value={l.id}>{l.name}{l.isActive ? '' : ' (inactive)'}</option>)}
      </select>
    </label>
  );
}

function LayoutShell({ auth }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = auth;
  const { selectedId, isManager } = useLocations();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };
  const sections = navSections
    .map(section => ({ ...section, items: section.items.filter(item => !isManager || item.managerToo) }))
    .filter(section => section.items.length > 0);

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-30 bg-white shadow-lg transition-all duration-200 lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'w-16' : 'w-56'}`}>
        <div className="flex items-center justify-between h-14 px-3 border-b">
          {!collapsed
            ? <img src={logoWordmark} alt="NClean" className="h-7 w-auto" />
            : <img src={logoMark} alt="NClean" className="h-8 w-8 mx-auto" />}
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}><HiOutlineX className="w-5 h-5" /></button>
        </div>
        <nav className="flex-1 px-2 py-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 100px)' }}>
          {sections.map((section) => (
            <div key={section.title} className="mb-2">
              {!collapsed && <p className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{section.title}</p>}
              {collapsed && <div className="border-b my-1 mx-2" />}
              {section.items.map((item) => (
                <NavLink key={item.path} to={item.path} end={item.path === '/'} onClick={() => setSidebarOpen(false)} title={collapsed ? item.label : ''}
                  className={({ isActive }) => `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${isActive ? 'bg-primary/10 text-secondary' : 'text-gray-600 hover:bg-gray-100'} ${collapsed ? 'justify-center' : ''}`}>
                  <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t p-2">
          <button onClick={handleLogout} className={`flex items-center gap-2.5 w-full px-2.5 py-2 text-[13px] text-red-600 rounded-lg hover:bg-red-50 ${collapsed ? 'justify-center' : ''}`}>
            <HiOutlineLogout className="w-[18px] h-[18px]" />{!collapsed && <span>Logout</span>}
          </button>
          <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex items-center w-full px-2.5 py-1.5 mt-1 text-xs text-gray-400 rounded-lg hover:bg-gray-100 justify-center">
            {collapsed ? <HiOutlineChevronRight className="w-4 h-4" /> : <HiOutlineChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white shadow-sm flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-gray-600" onClick={() => setSidebarOpen(true)}><HiOutlineMenu className="w-6 h-6" /></button>
            <span className="hidden xl:block text-sm text-gray-500">Welcome, <span className="font-medium text-gray-700">{user?.name || 'Admin'}</span></span>
            <LocationSwitcher />
          </div>
          <div className="flex items-center gap-3">
            <Link to="/pos" className="flex items-center gap-1.5 px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary-dark shadow-sm transition-colors">
              <HiOutlinePlus className="w-4 h-4" /><span className="hidden sm:inline">New Order</span>
            </Link>
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-secondary">{(user?.name || 'A')[0].toUpperCase()}</div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6"><Outlet key={selectedId || 'all'} /></main>
      </div>
    </div>
  );
}
