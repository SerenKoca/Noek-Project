import Room from '../../../../backend/models/Room.js'
import RoomContribution from '../../../../backend/models/RoomContribution.js'
import { connectToDatabase } from '../../../../src/server/lib/mongodb.js'
import { getOptionalAuth } from '../../../../src/server/middleware/optionalAuth.js'

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json')
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') return JSON.parse(req.body)
  return req.body
}

function countWords(value) {
  return (value || '').trim().split(/\s+/).filter(Boolean).length
}

async function findPublicRoom(roomId) {
  return Room.findOne({
    _id: roomId,
    $or: [{ isPublic: true }, { isPublic: { $exists: false } }]
  })
}

export default async function handler(req, res) {
  setJsonHeaders(res)

  try {
    await connectToDatabase()
  } catch (error) {
    console.error('MongoDB connection error:', error)
    res.status(500).json({ error: 'Databaseverbinding mislukt.' })
    return
  }

  const { id: roomId } = req.query
  const room = await findPublicRoom(roomId)
  if (!room) {
    res.status(404).json({ error: 'Publieke kamer niet gevonden.' })
    return
  }

  if (req.method === 'GET') {
    try {
      const items = await RoomContribution.find({ roomId: room._id, ownerId: room.ownerId }).sort({ createdAt: -1 })
      res.status(200).json(items)
    } catch (error) {
      console.error('getPublicRoomContributions error:', error)
      res.status(500).json({ error: 'Kon bijdragen niet ophalen.' })
    }
    return
  }

  if (req.method === 'POST') {
    try {
      const auth = getOptionalAuth(req)
      const {
        type,
        giverName,
        tributeText = '',
        mediaUrl = '',
        externalUrl = '',
        platform = 'none'
      } = parseBody(req)

      const normalizedGiverName = String(giverName || auth?.email || '').trim()

      if (!type || !normalizedGiverName) {
        res.status(400).json({ error: 'Type en naam van gever zijn verplicht.' })
        return
      }

      if ((type === 'photo' || type === 'video_file') && !String(mediaUrl || '').trim()) {
        res.status(400).json({ error: 'Media-URL is verplicht voor foto en video bestanden.' })
        return
      }

      if ((type === 'video_url' || type === 'music_url') && !String(externalUrl || '').trim()) {
        res.status(400).json({ error: 'Externe URL is verplicht voor muziek en video links.' })
        return
      }

      if (countWords(tributeText) > 150) {
        res.status(400).json({ error: 'Tekst mag maximaal 150 woorden bevatten.' })
        return
      }

      const item = new RoomContribution({
        roomId: room._id,
        ownerId: room.ownerId,
        createdByUserId: auth?.userId || '',
        type,
        giverName: normalizedGiverName,
        tributeText: String(tributeText || '').trim(),
        mediaUrl: String(mediaUrl || '').trim(),
        externalUrl: String(externalUrl || '').trim(),
        platform
      })

      await item.save()
      res.status(201).json(item)
    } catch (error) {
      console.error('createPublicRoomContribution error:', error)
      res.status(500).json({ error: 'Kon bijdrage niet opslaan.' })
    }
    return
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).json({ error: 'Method Not Allowed' })
}
