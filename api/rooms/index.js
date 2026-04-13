import Room from '../../backend/models/Room.js'
import { connectToDatabase } from '../../src/server/lib/mongodb.js'
import { requireAuth } from '../../src/server/middleware/authMiddleware.js'

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json')
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    return JSON.parse(req.body)
  }
  return req.body
}

export default async function handler(req, res) {
  setJsonHeaders(res)

  const auth = requireAuth(req, res)
  if (!auth) return

  try {
    await connectToDatabase()
  } catch (error) {
    console.error('MongoDB connection error:', error)
    res.status(500).json({ error: 'Databaseverbinding mislukt.' })
    return
  }

  if (req.method === 'GET') {
    try {
      const rooms = await Room.find({ ownerId: auth.userId }).sort({ createdAt: -1 })
      res.status(200).json(rooms)
    } catch (error) {
      console.error('getRooms error:', error)
      res.status(500).json({ error: 'Kon kamers niet ophalen.' })
    }
    return
  }

  if (req.method === 'POST') {
    try {
      const { name, userId, sceneData } = parseBody(req)

      if (!name || !sceneData) {
        res.status(400).json({ error: 'Naam en sceneData zijn verplicht.' })
        return
      }

      const room = new Room({
        name,
        userId: userId || null,
        ownerId: auth.userId,
        sceneData
      })
      await room.save()

      res.status(201).json(room)
    } catch (error) {
      console.error('createRoom error:', error)
      res.status(500).json({ error: 'Kon de kamer niet opslaan.' })
    }
    return
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).json({ error: 'Method Not Allowed' })
}