const requireRole = (role) => (req, res, next) => {
    console.log(req.user.role);
    
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized: No user info' });
  }
  if (Array.isArray(role)) {
    if (!role.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient role' });
    }
  } else {
    if (req.user.role !== role) {
      return res.status(403).json({ message: 'Forbidden: Insufficient role' });
    }
  }
  next();
};

module.exports = { requireRole };
