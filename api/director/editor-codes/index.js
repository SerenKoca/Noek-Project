import crypto from 'crypto'
import { connectToDatabase } from '../../../../src/server/lib/mongodb.js'
import { EditorRegistrationCode } from '../../../../src/server/models/EditorRegistrationCode.js'
import { requireAuth, requireRole } from '../../../../src/server/middleware/authMiddleware.js'

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json')
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') return JSON.parse(req.body)
  return req.body
}

function randomCode(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(length)
  let out = ''

  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length]
  }

  return out
}

async function generateUniqueCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode(8)
    const exists = await EditorRegistrationCode.findOne({ code })
    if (!exists) return code
  }

  throw new Error('Could not generate unique code')
}

export default async function handler(req, res) {
  setJsonHeaders(res)

  const auth = requireAuth(req, res)
  if (!auth) return
  if (!requireRole(auth, res, 'funeral_director')) return

  try {
    await connectToDatabase()
  } catch (error) {
    console.error('MongoDB connection error:', error)
    res.status(500).json({ error: 'Databaseverbinding mislukt.' })
    return
  }

  if (req.method === 'GET') {
    try {
      const items = await EditorRegistrationCode.find({ createdByDirectorId: auth.userId }).sort({ createdAt: -1 })
      res.status(200).json(
        items.map((item) => ({
          id: item._id,
          code: item.code,
          expiresAt: item.expiresAt,
          usedAt: item.usedAt,
          usedByUserId: item.usedByUserId || null,
          createdAt: item.createdAt
        }))
      )
    } catch (error) {
      console.error('listMyEditorCodes error:', error)
      res.status(500).json({ error: 'Kon registratiecodes niet ophalen.' })
    }
    return
  }

  if (req.method === 'POST') {
    try {
      const expiresInDaysRaw = Number(parseBody(req).expiresInDays)
      const expiresInDays = Number.isFinite(expiresInDaysRaw) ? Math.max(1, Math.min(365, Math.round(expiresInDaysRaw))) : 30

      const code = await generateUniqueCode()
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)

      const item = await EditorRegistrationCode.create({
        code,
        createdByDirectorId: auth.userId,
        expiresAt
      })

      res.status(201).json({
        id: item._id,
        code: item.code,
        expiresAt: item.expiresAt,
        usedAt: item.usedAt,
        createdAt: item.createdAt
      })
    } catch (error) {
      console.error('generateEditorCode error:', error)
      res.status(500).json({ error: 'Kon registratiecode niet aanmaken.' })
    }
    return
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).json({ error: 'Method Not Allowed' })
}
