const express = require('express')
const bcrypt = require('bcryptjs')
const Room = require('../models/Room')
const RoomContribution = require('../models/RoomContribution')
const User = require('../models/User')
const { requireAuth } = require('../middleware/authMiddleware')
const { createToken } = require('../lib/auth')

const router = express.Router()

const DEFAULT_BRAND_DARK = '#1e2b37'
const DEFAULT_BRAND_LIGHT = '#d7e1eb'

function normalizeHexColor(input, fallback) {
  const value = String(input || '').trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(value) ? value : fallback
}

function buildBrandingResponse(director) {
  return {
    logoUrl: String(director?.brandLogoUrl || '').trim(),
    darkColor: normalizeHexColor(director?.brandDarkColor, DEFAULT_BRAND_DARK),
    lightColor: normalizeHexColor(director?.brandLightColor, DEFAULT_BRAND_LIGHT),
    directorName: String(director?.displayName || '').trim()
  }
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

router.use(requireAuth)

router.get('/contributions', async (req, res) => {
  try {
    const items = await RoomContribution.find({ createdByUserId: req.auth?.userId }).sort({ createdAt: -1 })
    const roomIds = [...new Set(items.map((item) => String(item.roomId || '')).filter(Boolean))]
    const rooms = roomIds.length ? await Room.find({ _id: { $in: roomIds } }).select({ _id: 1, name: 1 }) : []
    const roomNameById = new Map(rooms.map((room) => [String(room._id), room.name]))

    const response = items.map((item) => ({
      ...item.toObject(),
      roomName: roomNameById.get(String(item.roomId || '')) || 'Onbekende kamer'
    }))

    res.json(response)
  } catch (error) {
    console.error('getMyContributions error:', error)
    res.status(500).json({ error: 'Kon eigen bijdragen niet ophalen.' })
  }
})

router.get('/branding', async (req, res) => {
  try {
    const currentUser = await User.findById(req.auth?.userId)
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

    res.json(buildBrandingResponse(director))
  } catch (error) {
    console.error('getMyBranding error:', error)
    res.status(500).json({ error: 'Kon branding niet ophalen.' })
  }
})

router.patch('/profile', async (req, res) => {
  try {
    const currentUser = await User.findById(req.auth?.userId)
    if (!currentUser) {
      res.status(404).json({ error: 'Gebruiker niet gevonden.' })
      return
    }

    const nextDisplayName = String(req.body?.displayName || '').trim()
    const nextEmail = String(req.body?.email || '').trim().toLowerCase()

    if (!nextDisplayName) {
      res.status(400).json({ error: 'Naam is verplicht.' })
      return
    }

    if (!nextEmail) {
      res.status(400).json({ error: 'Email is verplicht.' })
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      res.status(400).json({ error: 'Ongeldig emailadres.' })
      return
    }

    const normalizedDisplayName = nextDisplayName.slice(0, 80)
    const existing = await User.findOne({ email: nextEmail, _id: { $ne: currentUser._id } })
    if (existing) {
      res.status(409).json({ error: 'Er bestaat al een account met dit emailadres.' })
      return
    }

    currentUser.displayName = normalizedDisplayName
    currentUser.email = nextEmail
    await currentUser.save()

    const token = createToken({
      userId: String(currentUser._id),
      email: currentUser.email,
      role: currentUser.role || 'editor'
    })

    res.json({ token, user: sanitizeUser(currentUser) })
  } catch (error) {
    console.error('updateMyProfile error:', error)
    res.status(500).json({ error: 'Profiel kon niet worden opgeslagen.' })
  }
})

router.patch('/password', async (req, res) => {
  try {
    const currentUser = await User.findById(req.auth?.userId)
    if (!currentUser) {
      res.status(404).json({ error: 'Gebruiker niet gevonden.' })
      return
    }

    const currentPassword = String(req.body?.currentPassword || '')
    const newPassword = String(req.body?.newPassword || '')

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

    res.json({ token, user: sanitizeUser(currentUser) })
  } catch (error) {
    console.error('changeMyPassword error:', error)
    res.status(500).json({ error: 'Wachtwoord kon niet worden opgeslagen.' })
  }
})

module.exports = router
