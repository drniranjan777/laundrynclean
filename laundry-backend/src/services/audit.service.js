const { AdminAuditLog } = require('../models/pickup.model');

const plain = (value) => {
  if (value === undefined || value === null) return null;
  return JSON.parse(JSON.stringify(typeof value.toJSON === 'function' ? value.toJSON() : value));
};

/**
 * Records an admin change: who (actorId), what (action, e.g. 'slot.update'), on which entity, with the values
 * before and after. Runs in the caller's transaction so the log and the change commit together.
 */
const audit = (req, { action, entity, entityId = null, before = null, after = null }, transaction) => AdminAuditLog.create({
  actorId: req.user?.id || null,
  action,
  entity,
  entityId: entityId === null ? null : String(entityId),
  before: plain(before),
  after: plain(after),
}, { transaction });

module.exports = { audit };
