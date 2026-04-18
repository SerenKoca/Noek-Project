import { readBearerToken, verifyToken } from '../lib/auth.js'

export function sendUnauthorized(res, message = 'Niet geautoriseerd.') {
  res.status(401).json({ error: message })
}

export function requireAuth(req, res) {
  const token = readBearerToken(req)
  if (!token) {
    sendUnauthorized(res, 'Login vereist.')
    return null
  }

  try {
    const decoded = verifyToken(token)
    if (!decoded?.userId) {
      sendUnauthorized(res)
      return null
    }

    req.auth = {
      userId: decoded.userId,
      email: decoded.email || '',
      role: decoded.role || 'editor'
    }

    return req.auth
  } catch {
    sendUnauthorized(res, 'Sessie ongeldig of verlopen.')
    return null
  }
}
