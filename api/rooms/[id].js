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

  if (auth.role !== 'editor') {
    res.status(403).json({ error: 'Alleen editors kunnen kamers beheren.' })
    return
  }

  try {
    await connectToDatabase()
  } catch (error) {
    console.error('MongoDB connection error:', error)
    res.status(500).json({ error: 'Databaseverbinding mislukt.' })
    return
  }

  const { id } = req.query

  if (req.method === 'GET') {
    try {
      const room = await Room.findOne({ _id: id, ownerId: auth.userId })
      if (!room) {
        res.status(404).json({ error: 'Kamer niet gevonden.' })
        return
      }

      res.status(200).json(room)
    } catch (error) {
      console.error('getRoomById error:', error)
      res.status(500).json({ error: 'Kon kamer niet ophalen.' })
    }
    return
  }

  if (req.method === 'PUT') {
    try {
      const { name, sceneData } = parseBody(req)

      const updates = {}
      if (typeof name === 'string' && name.trim()) {
        updates.name = name.trim()
      }
      if (sceneData) {
        updates.sceneData = sceneData
      }

      if (!Object.keys(updates).length) {
        res.status(400).json({ error: 'Minstens naam of sceneData is verplicht.' })
        return
      }

      const room = await Room.findOneAndUpdate(
        { _id: id, ownerId: auth.userId },
        updates,
        { new: true, runValidators: true }
      )

      if (!room) {
        res.status(404).json({ error: 'Kamer niet gevonden.' })
        return
      }

      res.status(200).json(room)
    } catch (error) {
      console.error('updateRoom error:', error)
      res.status(500).json({ error: 'Kon de kamer niet bijwerken.' })
    }
    return
  }

  if (req.method === 'DELETE') {
    try {
      const room = await Room.findOneAndDelete({ _id: id, ownerId: auth.userId })
      if (!room) {
        res.status(404).json({ error: 'Kamer niet gevonden.' })
        return
      }

      res.status(200).json({ message: 'Kamer verwijderd.' })
    } catch (error) {
      console.error('deleteRoom error:', error)
      res.status(500).json({ error: 'Kon kamer niet verwijderen.' })
    }
    return
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
  res.status(405).json({ error: 'Method Not Allowed' })
}