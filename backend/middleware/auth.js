const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const secret = process.env.JWT_SECRET || 'your_jwt_secret';
    console.log('JWT Secret used:', secret ? 'Set' : 'Using fallback');
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    
    // Inject store_id from token for use in controllers
    if (decoded.store_id) {
      req.store_id = decoded.store_id;
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Role-based authorization middleware
 * Checks if user has one of the required roles
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    const user = req.user;
    
    if (!user || !user.role) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Super admin has access to everything
    if (user.role === 'super_admin') {
      return next();
    }
    
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

module.exports = { auth, authorize };