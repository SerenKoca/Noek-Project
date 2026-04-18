import { readBearerToken, verifyToken } from '../lib/auth.js'

export function getOptionalAuth(req) {
  const token = readBearerToken(req)
  if (!token) return null

  try {
    const decoded = verifyToken(token)
    if (!decoded?.userId) return null

    return {
      userId: decoded.userId,
      email: decoded.email || '',
      role: decoded.role || 'editor'
    }
  } catch {
    return null
  }
}
