const { createHmac, timingSafeEqual } = require('crypto')

function getRoomEditSecret() {
  const secret = process.env.ROOM_EDIT_SECRET || process.env.JWT_SECRET
  if (!secret) {
    throw new Error('Missing ROOM_EDIT_SECRET or JWT_SECRET')
  }
  return secret
}

function createRoomEditKey(roomId) {
  return createHmac('sha256', getRoomEditSecret()).update(String(roomId)).digest('base64url')
}

function verifyRoomEditKey(roomId, editKey) {
  const expected = createRoomEditKey(roomId)
  const provided = String(editKey || '').trim()

  if (!provided || provided.length !== expected.length) {
    return false
  }

  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
}

module.exports = {
  createRoomEditKey,
  verifyRoomEditKey
}