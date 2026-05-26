const Room = require('../models/Room')
const { readBearerToken, verifyToken } = require('../lib/auth')
const { verifyRoomEditKey } = require('../lib/roomEditAuth')

async function requireRoomAccess(req, res, next) {
  const bearerToken = readBearerToken(req)
  if (bearerToken) {
    try {
      const decoded = verifyToken(bearerToken)
      if (decoded?.userId) {
        req.auth = {
          userId: decoded.userId,
          email: decoded.email || '',
          role: decoded.role || 'editor'
        }
        next()
        return
      }
    } catch {
      // Fall through to room edit key handling.
    }
  }

  const roomId = String(req.params?.id || '').trim()
  const editKey = String(req.get('x-room-edit-key') || req.query?.editKey || '').trim()

  if (!roomId || !editKey) {
    res.status(401).json({ error: 'Login vereist.' })
    return
  }

  if (!verifyRoomEditKey(roomId, editKey)) {
    res.status(401).json({ error: 'Ongeldige bewerklink.' })
    return
  }

  const room = await Room.findById(roomId).select('ownerId')
  if (!room) {
    res.status(404).json({ error: 'Kamer niet gevonden.' })
    return
  }

  req.auth = {
    userId: room.ownerId || room._id.toString(),
    email: '',
    role: 'editor',
    editAccess: true
  }

  next()
}

module.exports = {
  requireRoomAccess
}