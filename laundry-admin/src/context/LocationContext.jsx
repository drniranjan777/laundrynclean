import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { LOCATION_STORAGE_KEY } from '../api/axios';

const LocationContext = createContext(null);

/**
 * Which store the admin panel is showing. Admins pick one (or all) in the header;
 * branch managers are fixed to their own store. The API client sends the admin's
 * choice with every request, so pages are filtered by the backend.
 */
export function LocationProvider({ user, children }) {
  const isManager = user?.role === 'manager';
  const [locations, setLocations] = useState([]);
  const [selectedId, setSelectedIdState] = useState(() => (
    isManager ? user.location?.id || null : localStorage.getItem(LOCATION_STORAGE_KEY) || null
  ));

  const refresh = useCallback(async () => {
    try {
      const res = await api.get('/admin/locations');
      setLocations(res.data || []);
    } catch (err) {
      setLocations([]);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const setSelectedId = useCallback((id) => {
    if (isManager) return;
    if (id) localStorage.setItem(LOCATION_STORAGE_KEY, id);
    else localStorage.removeItem(LOCATION_STORAGE_KEY);
    setSelectedIdState(id || null);
  }, [isManager]);

  // Forget a remembered store that has since been deleted
  useEffect(() => {
    if (!isManager && selectedId && locations.length && !locations.some(l => l.id === selectedId)) setSelectedId(null);
  }, [locations, selectedId, isManager, setSelectedId]);

  const current = locations.find(l => l.id === selectedId) || (isManager ? user.location : null);

  return (
    <LocationContext.Provider value={{ locations, selectedId, setSelectedId, current, isManager, refresh }}>
      {children}
    </LocationContext.Provider>
  );
}

export const useLocations = () => useContext(LocationContext);
