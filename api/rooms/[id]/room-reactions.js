import Room from '../../../backend/models/Room.js'
import { connectToDatabase } from '../../../src/server/lib/mongodb.js'
import { requireAuth } from '../../../src/server/middleware/authMiddleware.js'

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json')
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') return JSON.parse(req.body)
  return req.body
}

function normalizeReactionType(value) {
  const fieldByType = {
    heart: 'heartCount',
    support: 'supportCount',
    candle: 'candleCount'
  }
  const reactionType = String(value || '').trim()
  const reactionField = fieldByType[reactionType]
  return { reactionType, reactionField }
}

export default async function handler(req, res) {
  setJsonHeaders(res)

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const auth = requireAuth(req, res)
  if (!auth) return

  try {
    await connectToDatabase()
  } catch (error) {
    console.error('MongoDB connection error:', error)
    res.status(500).json({ error: 'Databaseverbinding mislukt.' })
    return
  }

  const { id } = req.query
  const room = await Room.findOne({ _id: id, ownerId: auth.userId })

  if (!room) {
    res.status(404).json({ error: 'Kamer niet gevonden.' })
    return
  }

  const { reactionType, reactionField } = normalizeReactionType(parseBody(req).reactionType)
  if (!reactionField) {
    res.status(400).json({ error: 'Onbekend reactietype.' })
    return
  }

  const userId = auth.userId
  const existingIndex = (room.roomReactedUsers || []).findIndex((entry) => entry.userId === userId)
  const existing = existingIndex >= 0 ? room.roomReactedUsers[existingIndex] : null

  if (existing?.reactionType === reactionType) {
    room.roomReactions[reactionField] = Math.max(0, (room.roomReactions?.[reactionField] || 0) - 1)
    room.roomReactedUsers.splice(existingIndex, 1)
  } else {
    if (existing?.reactionType) {
      const oldField = `${existing.reactionType}Count`
      room.roomReactions[oldField] = Math.max(0, (room.roomReactions?.[oldField] || 0) - 1)
      room.roomReactedUsers[existingIndex].reactionType = reactionType
    } else {
      room.roomReactedUsers.push({ userId, reactionType })
    }

    room.roomReactions[reactionField] = (room.roomReactions?.[reactionField] || 0) + 1
  }

  await room.save()
  res.status(200).json(room)
}
