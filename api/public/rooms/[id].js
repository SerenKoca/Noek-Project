import Room from '../../../backend/models/Room.js'
import { connectToDatabase } from '../../../src/server/lib/mongodb.js'

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

    res.status(200).json({
      _id: room._id,
      name: room.name,
      sceneData: room.sceneData,
      ambience: room.ambience,
      roomReactions: room.roomReactions,
      roomComments: room.roomComments,
      createdAt: room.createdAt
    })
  } catch (error) {
    console.error('getPublicRoom error:', error)
    res.status(500).json({ error: 'Kon publieke kamer niet ophalen.' })
  }
}
