import Room from '../../backend/models/Room.js'
import RoomContribution from '../../backend/models/RoomContribution.js'
import { connectToDatabase } from '../../src/server/lib/mongodb.js'
import { requireAuth } from '../../src/server/middleware/authMiddleware.js'

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json')
}

const DEFAULT_BRAND_DARK = '#1e2b37'
const DEFAULT_BRAND_LIGHT = '#d7e1eb'

function normalizeHexColor(input, fallback) {
  const value = String(input || '').trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(value) ? value : fallback
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') return JSON.parse(req.body)
  return req.body
}

// Handler for /api/me/branding
async function handleBranding(req, res, auth) {
  try {
    setJsonHeaders(res)

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

    const [mongoModule, userModule] = await Promise.all([
      import('../../src/server/lib/mongodb.js'),
      import('../../src/server/models/User.js')
    ])

    const { connectToDatabase } = mongoModule
    const { User } = userModule

    await connectToDatabase()

    const currentUser = await User.findById(auth.userId)
    if (!currentUser) {
      res.status(404).json({ error: 'Gebruiker niet gevonden.' })
      return
    }

    let director = null
    if (currentUser.role === 'funeral_director') {
      director = currentUser
    } else if (currentUser.funeralDirectorId) {
      director = await User.findOne({ _id: currentUser.funeralDirectorId, role: 'funeral_director' })
    }

    res.status(200).json({
      logoUrl: String(director?.brandLogoUrl || '').trim(),
      darkColor: normalizeHexColor(director?.brandDarkColor, DEFAULT_BRAND_DARK),
      lightColor: normalizeHexColor(director?.brandLightColor, DEFAULT_BRAND_LIGHT),
      directorName: String(director?.displayName || '').trim()
    })
  } catch (error) {
    console.error('ME_BRANDING handler error:', error)
    if (!res.headersSent) {
      setJsonHeaders(res)
      res.status(500).json({ error: 'Kon branding niet ophalen.', code: 'ME_BRANDING_ERROR' })
    }
  }
}

// Handler for /api/me/contributions
async function handleContributions(req, res, auth) {
  try {
    setJsonHeaders(res)

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

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

export default async function handler(req, res) {
  setJsonHeaders(res)

  const auth = requireAuth(req, res)
  if (!auth) return

  // Extract the path segment from the catch-all param
  const path = Array.isArray(req.query.path) ? req.query.path[0] : req.query.path || ''

  if (path === 'branding') {
    return handleBranding(req, res, auth)
  }

  if (path === 'contributions') {
    return handleContributions(req, res, auth)
  }

  res.status(404).json({ error: 'Endpoint niet gevonden.' })
}
