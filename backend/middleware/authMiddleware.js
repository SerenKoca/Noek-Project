const { readBearerToken, verifyToken } = require('../lib/auth')

function requireAuth(req, res, next) {
  const token = readBearerToken(req)
  if (!token) {
    res.status(401).json({ error: 'Login vereist.' })
    return
  }

  try {
    const decoded = verifyToken(token)
    if (!decoded?.userId) {
      res.status(401).json({ error: 'Niet geautoriseerd.' })
      return
    }

    req.auth = {
      userId: decoded.userId,
      email: decoded.email || '',
      role: decoded.role || 'editor'
    }

    next()
  } catch {
    res.status(401).json({ error: 'Sessie ongeldig of verlopen.' })
  }
}

function requireRole(roles) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles]

  return (req, res, next) => {
    if (!req.auth?.role) {
      res.status(401).json({ error: 'Login vereist.' })
      return
    }

    if (!allowedRoles.includes(req.auth.role)) {
      res.status(403).json({ error: 'Geen toegang voor deze rol.' })
      return
    }

    next()
  }
}

module.exports = {
  requireAuth,
  requireRole
}
