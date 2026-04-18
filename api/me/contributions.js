import Room from '../../backend/models/Room.js'
import RoomContribution from '../../backend/models/RoomContribution.js'
import { connectToDatabase } from '../../src/server/lib/mongodb.js'
import { requireAuth } from '../../src/server/middleware/authMiddleware.js'

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json')
}

export default async function handler(req, res) {
  setJsonHeaders(res)

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const auth = requireAuth(req, res)
  if (!auth) return

  try {
    await connectToDatabase()

    const items = await RoomContribution.find({ createdByUserId: auth.userId }).sort({ createdAt: -1 })
    const roomIds = [...new Set(items.map((item) => String(item.roomId || '')).filter(Boolean))]
    const rooms = roomIds.length ? await Room.find({ _id: { $in: roomIds } }).select({ _id: 1, name: 1 }) : []
    const roomNameById = new Map(rooms.map((room) => [String(room._id), room.name]))

    const response = items.map((item) => ({
      ...item.toObject(),
      roomName: roomNameById.get(String(item.roomId || '')) || 'Onbekende kamer'
    }))

    res.status(200).json(response)
  } catch (error) {
    console.error('getMyContributions error:', error)
    res.status(500).json({ error: 'Kon eigen bijdragen niet ophalen.' })
  }
}
