// Store Access Middleware
// Validates that users can only access their assigned stores
// Role-based access control for multi-tenancy

const db = require('../config/database');

/**
 * Middleware to ensure user can access requested store
 * - Store managers can only access their own store
 * - Area managers can access stores in their area
 * - Regional managers can access stores in their region
 * - Super admins can access all stores
 */
const validateStoreAccess = async (req, res, next) => {
  try {
    const user = req.user;
    const requestedStoreId = req.params.storeId || req.body.store_id || req.query.store_id;

    // Super admin can access all stores
    if (user.role === 'super_admin') {
      return next();
    }

    // If no store_id in request, use user's store_id
    if (!requestedStoreId && user.store_id) {
      req.store_id = user.store_id;
      return next();
    }

    // If requested store_id matches user's store_id, allow
    if (requestedStoreId && user.store_id && parseInt(requestedStoreId) === user.store_id) {
      req.store_id = user.store_id;
      return next();
    }

    // For area/regional managers, check if store is in their jurisdiction
    if (user.role === 'area_manager' || user.role === 'regional_manager') {
      const [stores] = await db.execute(
        'SELECT * FROM stores WHERE id = ?',
        [requestedStoreId]
      );
      
      if (stores.length === 0) {
        return res.status(404).json({ error: 'Store not found' });
      }

      const store = stores[0];
      
      // Check if user is assigned as area/regional manager for this store
      if (user.role === 'area_manager' && store.area_manager_id !== user.id) {
        return res.status(403).json({ error: 'Access denied: Store not in your area' });
      }
      
      if (user.role === 'regional_manager' && store.regional_manager_id !== user.id) {
        return res.status(403).json({ error: 'Access denied: Store not in your region' });
      }
      
      req.store_id = requestedStoreId;
      return next();
    }

    // Store manager trying to access different store
    if (user.role === 'store_manager' && requestedStoreId && parseInt(requestedStoreId) !== user.store_id) {
      return res.status(403).json({ error: 'Access denied: You can only access your own store' });
    }

    // Default: use user's store_id
    req.store_id = user.store_id;
    next();
  } catch (error) {
    console.error('Store access middleware error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Middleware to inject store_id into request
 * For endpoints that don't have explicit store_id in params/body
 */
const injectStoreId = (req, res, next) => {
  const user = req.user;
  
  // Super admin must provide store_id
  if (user.role === 'super_admin') {
    const storeId = req.params.storeId || req.body.store_id || req.query.store_id;
    if (!storeId) {
      return res.status(400).json({ error: 'store_id is required for super admin' });
    }
    req.store_id = parseInt(storeId);
    return next();
  }
  
  // Other roles use their assigned store_id
  req.store_id = user.store_id;
  next();
};

/**
 * Role-based access control middleware
 * Checks if user has required role
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    const user = req.user;
    
    if (!user || !user.role) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

module.exports = {
  validateStoreAccess,
  injectStoreId,
  requireRole
};
