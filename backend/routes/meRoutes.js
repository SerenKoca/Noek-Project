const express = require('express')
const Room = require('../models/Room')
const RoomContribution = require('../models/RoomContribution')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

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

module.exports = router
