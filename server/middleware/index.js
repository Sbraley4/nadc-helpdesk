const { requireAuth } = require('./auth');
const { requireRole } = require('./requireRole');
const {
  validate,
  loginValidation,
  createAgentValidation,
  updateAgentValidation,
  updateAvailabilityValidation,
  createGroupValidation,
} = require('./validate');

module.exports = {
  requireAuth,
  requireRole,
  validate,
  loginValidation,
  createAgentValidation,
  updateAgentValidation,
  updateAvailabilityValidation,
  createGroupValidation,
};
