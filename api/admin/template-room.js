import Room from '../../backend/models/Room.js'
import { User } from '../../src/server/models/User.js'
import { connectToDatabase } from '../../src/server/lib/mongodb.js'
import { requireAuth, requireRole } from '../../src/server/middleware/authMiddleware.js'

const TEMPLATE_OWNER_EMAIL = String(
  process.env.ROOM_TEMPLATE_OWNER_EMAIL || process.env.VITE_ROOM_TEMPLATE_OWNER_EMAIL || 'editor@test.be'
).trim().toLowerCase()

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json')
}

function buildFallbackTemplateSceneData() {
  return {
    templateSlots: [],
    furniture: [],
    appearance: {},
    metadata: {
      generatedAt: new Date().toISOString(),
      source: 'fallback-template'
    }
  }
}

async function findTemplateRoom() {
  const templateOwner = await User.findOne({ email: TEMPLATE_OWNER_EMAIL, role: 'editor' })
  if (!templateOwner) return null

  return Room.findOne({ ownerId: templateOwner._id }).sort({ createdAt: 1 })
}

export default async function handler(req, res) {
  setJsonHeaders(res)

  const auth = requireAuth(req, res)
  if (!auth) return
  if (!requireRole(auth, res, 'admin')) return

  try {
    await connectToDatabase()
  } catch (error) {
    console.error('ADMIN_TEMPLATE_ROOM connect error:', error)
    res.status(500).json({ error: 'Databaseverbinding mislukt.' })
    return
  }

  if (req.method === 'GET') {
    try {
      const templateRoom = await findTemplateRoom()
      if (templateRoom?.sceneData) {
        res.status(200).json({
          roomId: templateRoom._id,
          name: templateRoom.name,
          sceneData: templateRoom.sceneData,
          source: 'template-room'
        })
        return
      }

      res.status(200).json({
        roomId: '',
        name: 'Template kamer',
        sceneData: buildFallbackTemplateSceneData(),
        source: 'fallback-template'
      })
    } catch (error) {
      console.error('getTemplateRoom error:', error)
      res.status(500).json({ error: 'Kon template kamer niet ophalen.' })
    }
    return
  }

  if (req.method === 'PUT') {
    try {
      const sceneData = req.body?.sceneData
      if (!sceneData || typeof sceneData !== 'object') {
        res.status(400).json({ error: 'sceneData is verplicht.' })
        return
      }

      const templateRoom = await findTemplateRoom()
      if (!templateRoom) {
        res.status(404).json({ error: 'Template kamer niet gevonden.' })
        return
      }

      templateRoom.sceneData = sceneData
      await templateRoom.save()

      res.status(200).json({
        roomId: templateRoom._id,
        name: templateRoom.name,
        sceneData: templateRoom.sceneData,
        source: 'template-room'
      })
    } catch (error) {
      console.error('updateTemplateRoom error:', error)
      res.status(500).json({ error: 'Kon template kamer niet opslaan.' })
    }
    return
  }

  res.setHeader('Allow', ['GET', 'PUT'])
  res.status(405).json({ error: 'Method Not Allowed' })
}