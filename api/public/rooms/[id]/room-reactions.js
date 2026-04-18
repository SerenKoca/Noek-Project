import Room from '../../../../../backend/models/Room.js'
import { connectToDatabase } from '../../../../../src/server/lib/mongodb.js'
import { getOptionalAuth } from '../../../../../src/server/middleware/optionalAuth.js'

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json')
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') return JSON.parse(req.body)
  return req.body
}

function resolveActorId(req, body, auth) {
  if (auth?.userId) return `user:${auth.userId}`
  const key = String(body.visitorKey || req.headers['x-visitor-key'] || '').trim()
  if (!key) return ''
  return `guest:${key}`
}

export default async function handler(req, res) {
  setJsonHeaders(res)

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const auth = getOptionalAuth(req)
  const body = parseBody(req)
  const actorId = resolveActorId(req, body, auth)

  if (!actorId) {
    res.status(400).json({ error: 'Bezoeker sleutel ontbreekt.' })
    return
  }

  try {
    await connectToDatabase()

    const { id } = req.query
    const room = await Room.findOne({
      _id: id,
      $or: [{ isPublic: true }, { isPublic: { $exists: false } }]
    })

    if (!room) {
      res.status(404).json({ error: 'Publieke kamer niet gevonden.' })
      return
    }

    const reactionType = String(body.reactionType || '').trim()
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

    const existingIndex = (room.roomReactedUsers || []).findIndex((entry) => entry.userId === actorId)
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
        room.roomReactedUsers.push({ userId: actorId, reactionType })
      }

      room.roomReactions[reactionField] = (room.roomReactions?.[reactionField] || 0) + 1
    }

    await room.save()
    res.status(200).json(room)
  } catch (error) {
    console.error('reactToPublicRoom error:', error)
    res.status(500).json({ error: 'Kon reactie niet opslaan.' })
  }
}
