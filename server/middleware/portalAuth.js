const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const PORTAL_JWT_SECRET = JWT_SECRET + '_portal';

/**
 * Middleware to require portal authentication
 * Verifies portal JWT and attaches contact info to request
 */
function requirePortalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  try {
    const payload = jwt.verify(token, PORTAL_JWT_SECRET);

    // Verify it's a portal token
    if (payload.type !== 'portal') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Attach contact info to request
    req.contact = {
      id: payload.contactId,
      email: payload.email,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = {
  requirePortalAuth,
};
