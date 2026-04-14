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

  const body = parseBody(req)
  const text = String(body.text || '').trim()
  const displayName = String(body.displayName || auth.email || 'Gebruiker').trim()

  if (!text) {
    res.status(400).json({ error: 'Commentaar mag niet leeg zijn.' })
    return
  }

  if (text.length > 500) {
    res.status(400).json({ error: 'Commentaar mag maximaal 500 tekens bevatten.' })
    return
  }

  room.roomComments.push({
    userId: auth.userId,
    displayName,
    text
  })

  await room.save()
  res.status(200).json(room)
}
