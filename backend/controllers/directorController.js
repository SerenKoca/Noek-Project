const crypto = require('crypto')
const User = require('../models/User')
const EditorRegistrationCode = require('../models/EditorRegistrationCode')

const DEFAULT_BRAND_DARK = '#1e2b37'
const DEFAULT_BRAND_LIGHT = '#d7e1eb'

function normalizeHexColor(input, fallback) {
  const value = String(input || '').trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(value) ? value : fallback
}

function sanitizeBranding(user) {
  return {
    logoUrl: String(user?.brandLogoUrl || '').trim(),
    darkColor: normalizeHexColor(user?.brandDarkColor, DEFAULT_BRAND_DARK),
    lightColor: normalizeHexColor(user?.brandLightColor, DEFAULT_BRAND_LIGHT),
    directorName: String(user?.displayName || '').trim()
  }
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

async function purgeExpiredEditorCodes(directorId) {
  const cutoff = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
  await EditorRegistrationCode.deleteMany({
    createdByDirectorId: directorId,
    usedAt: null,
    usedByUserId: null,
    expiresAt: { $lt: cutoff }
  })
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
    await purgeExpiredEditorCodes(directorId)
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
    await purgeExpiredEditorCodes(directorId)
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

exports.getMyBranding = async (req, res) => {
  try {
    const director = await User.findOne({ _id: req.auth?.userId, role: 'funeral_director' })
    if (!director) {
      res.status(404).json({ error: 'Uitvaartondernemer niet gevonden.' })
      return
    }

    res.json(sanitizeBranding(director))
  } catch (error) {
    console.error('getMyBranding error:', error)
    res.status(500).json({ error: 'Kon branding niet ophalen.' })
  }
}

exports.updateMyBranding = async (req, res) => {
  try {
    const director = await User.findOne({ _id: req.auth?.userId, role: 'funeral_director' })
    if (!director) {
      res.status(404).json({ error: 'Uitvaartondernemer niet gevonden.' })
      return
    }

    const logoUrl = String(req.body?.logoUrl || '').trim()
    const darkColor = normalizeHexColor(req.body?.darkColor, DEFAULT_BRAND_DARK)
    const lightColor = normalizeHexColor(req.body?.lightColor, DEFAULT_BRAND_LIGHT)

    director.brandLogoUrl = logoUrl.slice(0, 2048)
    director.brandDarkColor = darkColor
    director.brandLightColor = lightColor
    await director.save()

    res.json(sanitizeBranding(director))
  } catch (error) {
    console.error('updateMyBranding error:', error)
    res.status(500).json({ error: 'Kon branding niet opslaan.' })
  }
}
