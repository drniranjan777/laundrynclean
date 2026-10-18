import axios from 'axios';

// Store picked in the header's location switcher (admins only; managers are fixed to theirs)
export const LOCATION_STORAGE_KEY = 'admin_location_id';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const locationId = localStorage.getItem(LOCATION_STORAGE_KEY);
  if (locationId) {
    config.headers['X-Location-Id'] = locationId;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default api;
