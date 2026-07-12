/* =================================================================
   DUODROP — Auth Middleware
   Verifies Firebase ID tokens sent in the Authorization header.
   ================================================================= */
const { verifyIdToken } = require('../config/firebase');

/**
 * requireAuth — blocks request if no valid Firebase ID token provided.
 * Populates req.user (Firebase user) and req.idToken.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header missing or invalid' });
    }
    const idToken = header.slice(7).trim();
    const user    = await verifyIdToken(idToken);
    req.user    = user;
    req.idToken = idToken;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please sign in again.' });
  }
}

/**
 * optionalAuth — attaches user if token present; does NOT fail if missing.
 */
async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      const idToken = header.slice(7).trim();
      req.user    = await verifyIdToken(idToken);
      req.idToken = idToken;
    }
  } catch (_) { /* no token or invalid — continue as guest */ }
  next();
}

module.exports = { requireAuth, optionalAuth };
