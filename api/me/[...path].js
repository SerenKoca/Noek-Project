import Room from '../../backend/models/Room.js'
import RoomContribution from '../../backend/models/RoomContribution.js'
import bcrypt from 'bcryptjs'
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

function sanitizeUser(user) {
  return {
    id: user._id,
    email: user.email,
    displayName: user.displayName,
    role: user.role || 'editor',
    funeralDirectorId: user.funeralDirectorId || null
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
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

async function handleProfile(req, res, auth) {
  try {
    setJsonHeaders(res)

    if (req.method !== 'PATCH') {
      res.setHeader('Allow', ['PATCH'])
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

    const [{ User }, authModule] = await Promise.all([
      import('../../src/server/models/User.js'),
      import('../../src/server/lib/auth.js')
    ])

    const { createToken } = authModule
    await connectToDatabase()

    const currentUser = await User.findById(auth.userId)
    if (!currentUser) {
      res.status(404).json({ error: 'Gebruiker niet gevonden.' })
      return
    }

    const body = parseBody(req)
    const nextDisplayName = String(body?.displayName || '').trim()
    const nextEmail = String(body?.email || '').trim().toLowerCase()

    if (!nextDisplayName) {
      res.status(400).json({ error: 'Naam is verplicht.' })
      return
    }

    if (!nextEmail) {
      res.status(400).json({ error: 'Email is verplicht.' })
      return
    }

    if (!isValidEmail(nextEmail)) {
      res.status(400).json({ error: 'Ongeldig emailadres.' })
      return
    }

    const existing = await User.findOne({ email: nextEmail, _id: { $ne: currentUser._id } })
    if (existing) {
      res.status(409).json({ error: 'Er bestaat al een account met dit emailadres.' })
      return
    }

    currentUser.displayName = nextDisplayName.slice(0, 80)
    currentUser.email = nextEmail
    await currentUser.save()

    const token = createToken({
      userId: String(currentUser._id),
      email: currentUser.email,
      role: currentUser.role || 'editor'
    })

    res.status(200).json({ token, user: sanitizeUser(currentUser) })
  } catch (error) {
    console.error('ME_PROFILE handler error:', error)
    if (!res.headersSent) {
      setJsonHeaders(res)
      res.status(500).json({ error: 'Profiel kon niet worden opgeslagen.', code: 'ME_PROFILE_ERROR' })
    }
  }
}

async function handlePassword(req, res, auth) {
  try {
    setJsonHeaders(res)

    if (req.method !== 'PATCH') {
      res.setHeader('Allow', ['PATCH'])
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

    const [{ User }, authModule] = await Promise.all([
      import('../../src/server/models/User.js'),
      import('../../src/server/lib/auth.js')
    ])

    const { createToken } = authModule
    await connectToDatabase()

    const currentUser = await User.findById(auth.userId)
    if (!currentUser) {
      res.status(404).json({ error: 'Gebruiker niet gevonden.' })
      return
    }

    const body = parseBody(req)
    const currentPassword = String(body?.currentPassword || '')
    const newPassword = String(body?.newPassword || '')

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Huidig en nieuw wachtwoord zijn verplicht.' })
      return
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'Nieuw wachtwoord moet minstens 8 tekens hebben.' })
      return
    }

    const ok = await bcrypt.compare(currentPassword, currentUser.passwordHash)
    if (!ok) {
      res.status(401).json({ error: 'Huidig wachtwoord is onjuist.' })
      return
    }

    currentUser.passwordHash = await bcrypt.hash(newPassword, 10)
    await currentUser.save()

    const token = createToken({
      userId: String(currentUser._id),
      email: currentUser.email,
      role: currentUser.role || 'editor'
    })

    res.status(200).json({ token, user: sanitizeUser(currentUser) })
  } catch (error) {
    console.error('ME_PASSWORD handler error:', error)
    if (!res.headersSent) {
      setJsonHeaders(res)
      res.status(500).json({ error: 'Wachtwoord kon niet worden opgeslagen.', code: 'ME_PASSWORD_ERROR' })
    }
  }
}

export default async function handler(req, res) {
  setJsonHeaders(res)

  const auth = requireAuth(req, res)
  if (!auth) return

  // Extract the path segment from req.url
  const url = new URL(req.url || '/', 'http://localhost')
  const pathname = url.pathname
  const basePath = '/api/me'
  const remaining = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : ''
  const segments = remaining.split('/').filter(Boolean)
  const path = segments[0] || ''

  if (path === 'branding') {
    return handleBranding(req, res, auth)
  }

  if (path === 'contributions') {
    return handleContributions(req, res, auth)
  }

  if (path === 'profile') {
    return handleProfile(req, res, auth)
  }

  if (path === 'password') {
    return handlePassword(req, res, auth)
  }

  res.status(404).json({ error: 'Endpoint niet gevonden.' })
}
