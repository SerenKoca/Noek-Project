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

export default async function handler(req, res) {
  setJsonHeaders(res)

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const auth = getOptionalAuth(req)

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

    const body = parseBody(req)
    const text = String(body.text || '').trim()
    const displayName = String(body.displayName || auth?.email || 'Bezoeker').trim()

    if (!text) {
      res.status(400).json({ error: 'Commentaar mag niet leeg zijn.' })
      return
    }

    if (text.length > 500) {
      res.status(400).json({ error: 'Commentaar mag maximaal 500 tekens bevatten.' })
      return
    }

    room.roomComments.push({
      userId: auth?.userId || '',
      displayName,
      text
    })

    await room.save()
    res.status(200).json(room)
  } catch (error) {
    console.error('addPublicRoomComment error:', error)
    res.status(500).json({ error: 'Kon commentaar niet opslaan.' })
  }
}
