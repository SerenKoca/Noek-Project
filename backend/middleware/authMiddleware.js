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
      email: decoded.email || ''
    }

    next()
  } catch {
    res.status(401).json({ error: 'Sessie ongeldig of verlopen.' })
  }
}

module.exports = {
  requireAuth
}
