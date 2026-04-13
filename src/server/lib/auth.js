import jwt from 'jsonwebtoken'

const TOKEN_TTL = '7d'

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('Missing JWT_SECRET')
  }
  return secret
}

export function createToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_TTL })
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret())
}

export function readBearerToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization
  if (!authHeader || typeof authHeader !== 'string') return null
  if (!authHeader.startsWith('Bearer ')) return null
  return authHeader.slice(7).trim()
}
