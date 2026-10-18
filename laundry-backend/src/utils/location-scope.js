const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value) => typeof value === 'string' && UUID_PATTERN.test(value);

/**
 * The location a staff request is limited to: a branch manager's own location, or the
 * location an admin picked in the admin panel's switcher (X-Location-Id header).
 * null means all locations.
 */
const scopedLocationId = (req) => {
  if (req.user?.role === 'manager') return req.user.locationId;
  const picked = req.headers['x-location-id'];
  return isUuid(picked) ? picked : null;
};

/** `where` fragment for models with a locationId column */
const locationFilter = (req) => {
  const locationId = scopedLocationId(req);
  return locationId ? { locationId } : {};
};

/** Admins can act on any location; branch managers only on their own */
const canAccessLocation = (req, locationId) => req.user?.role !== 'manager' || locationId === req.user.locationId;

module.exports = { isUuid, scopedLocationId, locationFilter, canAccessLocation };
