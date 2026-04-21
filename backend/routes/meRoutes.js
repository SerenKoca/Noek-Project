const express = require('express')
const Room = require('../models/Room')
const RoomContribution = require('../models/RoomContribution')
const User = require('../models/User')
const { requireAuth } = require('../middleware/authMiddleware')

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

module.exports = router
