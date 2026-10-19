import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BookingsPage from './pages/BookingsPage';
import UsersPage from './pages/UsersPage';
import CategoriesPage from './pages/CategoriesPage';
import CataloguePage from './pages/CataloguePage';
import OrderStatusPage from './pages/OrderStatusPage';
import DeliveryBoysPage from './pages/DeliveryBoysPage';
import WalletPackagesPage from './pages/WalletPackagesPage';
import WalletCreditsPage from './pages/WalletCreditsPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import PromoCodesPage from './pages/PromoCodesPage';
import PincodesPage from './pages/PincodesPage';
import ContentPage from './pages/ContentPage';
import GstSettingsPage from './pages/GstSettingsPage';
import PosPage from './pages/PosPage';
import LocationsPage from './pages/LocationsPage';
import SchedulePickupPage from './pages/SchedulePickupPage';
import { useAuth } from './hooks/useAuth';

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

// Pages branch managers can't use (the API refuses them too)
function AdminOnly({ children }) {
  const { user } = useAuth();
  if (user?.role === 'manager') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="orders" element={<BookingsPage />} />
        <Route path="users" element={<AdminOnly><UsersPage /></AdminOnly>} />
        <Route path="categories" element={<AdminOnly><CategoriesPage /></AdminOnly>} />
        <Route path="catalogue" element={<AdminOnly><CataloguePage /></AdminOnly>} />
        <Route path="order-status" element={<OrderStatusPage />} />
        <Route path="schedule-pickup" element={<SchedulePickupPage />} />
        <Route path="delivery-boys" element={<DeliveryBoysPage />} />
        <Route path="wallet-packages" element={<AdminOnly><WalletPackagesPage /></AdminOnly>} />
        <Route path="wallet-credits" element={<AdminOnly><WalletCreditsPage /></AdminOnly>} />
        <Route path="subscriptions" element={<AdminOnly><SubscriptionsPage /></AdminOnly>} />
        <Route path="promo-codes" element={<AdminOnly><PromoCodesPage /></AdminOnly>} />
        <Route path="pincodes" element={<AdminOnly><PincodesPage /></AdminOnly>} />
        <Route path="content" element={<AdminOnly><ContentPage /></AdminOnly>} />
        <Route path="gst-settings" element={<AdminOnly><GstSettingsPage /></AdminOnly>} />
        <Route path="pos" element={<PosPage />} />
        <Route path="locations" element={<AdminOnly><LocationsPage /></AdminOnly>} />
      </Route>
    </Routes>
  );
}
