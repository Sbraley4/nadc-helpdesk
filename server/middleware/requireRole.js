/**
 * Middleware factory to check if user has one of the allowed roles.
 * Must be used after requireAuth middleware.
 *
 * @param {...string} roles - Allowed roles (e.g., 'ADMIN', 'AGENT')
 * @returns {Function} Express middleware
 *
 * @example
 * router.post('/agents', requireAuth, requireRole('ADMIN'), createAgent);
 * router.get('/dashboard', requireAuth, requireRole('ADMIN', 'AGENT'), getDashboard);
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

module.exports = { requireRole };
