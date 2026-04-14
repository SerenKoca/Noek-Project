import Room from '../../../../../backend/models/Room.js'
import RoomContribution from '../../../../../backend/models/RoomContribution.js'
import { connectToDatabase } from '../../../../../src/server/lib/mongodb.js'
import { requireAuth } from '../../../../../src/server/middleware/authMiddleware.js'

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json')
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') return JSON.parse(req.body)
  return req.body
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

  const { id: roomId, contributionId } = req.query

  const room = await Room.findOne({ _id: roomId, ownerId: auth.userId })
  if (!room) {
    res.status(404).json({ error: 'Kamer niet gevonden.' })
    return
  }

  const item = await RoomContribution.findOne({ _id: contributionId, roomId: room._id, ownerId: auth.userId })
  if (!item) {
    res.status(404).json({ error: 'Bijdrage niet gevonden.' })
    return
  }

  const reactionType = (parseBody(req).reactionType || '').trim()
  const fieldByType = {
    heart: 'heartCount',
    support: 'supportCount',
    candle: 'candleCount'
  }
  const reactionField = fieldByType[reactionType]

  if (!reactionField) {
    res.status(400).json({ error: 'Onbekend reactietype.' })
    return
  }

  const userId = auth.userId
  const fieldByTypeReverse = {
    heartCount: 'heart',
    supportCount: 'support',
    candleCount: 'candle'
  }

  const existingIndex = (item.reactedUsers || []).findIndex((entry) => entry.userId === userId)
  const existing = existingIndex >= 0 ? item.reactedUsers[existingIndex] : null

  if (existing?.reactionType === reactionType) {
    item.reactions[reactionField] = Math.max(0, (item.reactions?.[reactionField] || 0) - 1)
    item.reactedUsers.splice(existingIndex, 1)
  } else {
    if (existing?.reactionType) {
      const oldField = `${existing.reactionType}Count`
      if (fieldByTypeReverse[oldField]) {
        item.reactions[oldField] = Math.max(0, (item.reactions?.[oldField] || 0) - 1)
      }
      item.reactedUsers[existingIndex].reactionType = reactionType
    } else {
      item.reactedUsers.push({ userId, reactionType })
    }

    item.reactions[reactionField] = (item.reactions?.[reactionField] || 0) + 1
  }

  await item.save()

  res.status(200).json(item)
}
