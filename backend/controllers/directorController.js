const crypto = require('crypto')
const User = require('../models/User')
const EditorRegistrationCode = require('../models/EditorRegistrationCode')

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

exports.listMyEditors = async (req, res) => {
  try {
    const directorId = req.auth?.userId
    const editors = await User.find({ role: 'editor', funeralDirectorId: directorId }).sort({ createdAt: -1 })

    res.json(
      editors.map((item) => ({
        id: item._id,
        email: item.email,
        displayName: item.displayName,
        role: item.role,
        createdAt: item.createdAt
      }))
    )
  } catch (error) {
    console.error('listMyEditors error:', error)
    res.status(500).json({ error: 'Kon klanten niet ophalen.' })
  }
}

exports.generateEditorCode = async (req, res) => {
  try {
    const directorId = req.auth?.userId
    const expiresInDaysRaw = Number(req.body?.expiresInDays)
    const expiresInDays = Number.isFinite(expiresInDaysRaw) ? Math.max(1, Math.min(365, Math.round(expiresInDaysRaw))) : 30

    const code = await generateUniqueCode()
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)

    const item = await EditorRegistrationCode.create({
      code,
      createdByDirectorId: directorId,
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
}

exports.listMyEditorCodes = async (req, res) => {
  try {
    const directorId = req.auth?.userId
    const items = await EditorRegistrationCode.find({ createdByDirectorId: directorId }).sort({ createdAt: -1 })

    res.json(
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
}
