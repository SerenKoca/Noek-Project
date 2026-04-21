const express = require('express')
const Room = require('../models/Room')
const RoomContribution = require('../models/RoomContribution')
const User = require('../models/User')
const { readBearerToken, verifyToken } = require('../lib/auth')

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

async function resolveRoomBranding(room) {
  const ownerId = resolveOwnerId(room)
  if (!ownerId) return buildBrandingResponse(null)

  const owner = await User.findById(ownerId).select({ role: 1, funeralDirectorId: 1 })
  if (!owner) return buildBrandingResponse(null)

  if (owner.role === 'funeral_director') {
    const director = await User.findById(owner._id).select({ displayName: 1, brandLogoUrl: 1, brandDarkColor: 1, brandLightColor: 1 })
    return buildBrandingResponse(director)
  }

  if (!owner.funeralDirectorId) return buildBrandingResponse(null)

  const director = await User.findOne({ _id: owner.funeralDirectorId, role: 'funeral_director' })
    .select({ displayName: 1, brandLogoUrl: 1, brandDarkColor: 1, brandLightColor: 1 })

  return buildBrandingResponse(director)
}

function getOptionalAuth(req) {
  const token = readBearerToken(req)
  if (!token) return null

  try {
    const decoded = verifyToken(token)
    if (!decoded?.userId) return null

    return {
      userId: decoded.userId,
      email: decoded.email || '',
      role: decoded.role || 'editor'
    }
  } catch {
    return null
  }
}

function countWords(value) {
  return (value || '').trim().split(/\s+/).filter(Boolean).length
}

function resolveActorId(req, body, auth) {
  if (auth?.userId) return `user:${auth.userId}`
  const key = String(body.visitorKey || req.headers['x-visitor-key'] || '').trim()
  if (!key) return ''
  return `guest:${key}`
}

async function findPublicRoom(roomId) {
  return Room.findOne({
    _id: roomId,
    $or: [{ isPublic: true }, { isPublic: { $exists: false } }]
  })
}

function resolveOwnerId(room) {
  return String(room?.ownerId || room?.userId || '').trim()
}

router.get('/rooms/:id', async (req, res) => {
  try {
    const room = await findPublicRoom(req.params.id)
    if (!room) {
      res.status(404).json({ error: 'Publieke kamer niet gevonden.' })
      return
    }

    const branding = await resolveRoomBranding(room)

    res.json({
      _id: room._id,
      name: room.name,
      sceneData: room.sceneData,
      ambience: room.ambience,
      branding,
      roomReactions: room.roomReactions,
      roomComments: room.roomComments,
      createdAt: room.createdAt
    })
  } catch (error) {
    console.error('getPublicRoom error:', error)
    res.status(500).json({ error: 'Kon publieke kamer niet ophalen.' })
  }
})

router.get('/rooms/:id/contributions', async (req, res) => {
  try {
    const room = await findPublicRoom(req.params.id)
    if (!room) {
      res.status(404).json({ error: 'Publieke kamer niet gevonden.' })
      return
    }

    const ownerId = resolveOwnerId(room)

    const items = await RoomContribution.find({ roomId: room._id, ownerId }).sort({ createdAt: -1 })
    res.json(items)
  } catch (error) {
    console.error('getPublicRoomContributions error:', error)
    res.status(500).json({ error: 'Kon bijdragen niet ophalen.' })
  }
})

router.post('/rooms/:id/contributions', async (req, res) => {
  try {
    const room = await findPublicRoom(req.params.id)
    if (!room) {
      res.status(404).json({ error: 'Publieke kamer niet gevonden.' })
      return
    }

    const ownerId = resolveOwnerId(room)

    const auth = getOptionalAuth(req)
    const {
      type,
      giverName,
      tributeText = '',
      mediaUrl = '',
      externalUrl = '',
      platform = 'none'
    } = req.body || {}

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
      ownerId,
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
})

router.post('/rooms/:id/contributions/:contributionId/reactions', async (req, res) => {
  const auth = getOptionalAuth(req)
  const actorId = resolveActorId(req, req.body || {}, auth)

  if (!actorId) {
    res.status(400).json({ error: 'Bezoeker sleutel ontbreekt.' })
    return
  }

  try {
    const room = await findPublicRoom(req.params.id)
    if (!room) {
      res.status(404).json({ error: 'Publieke kamer niet gevonden.' })
      return
    }

    const ownerId = resolveOwnerId(room)

    const item = await RoomContribution.findOne({ _id: req.params.contributionId, roomId: room._id, ownerId })
    if (!item) {
      res.status(404).json({ error: 'Bijdrage niet gevonden.' })
      return
    }

    const reactionType = String(req.body?.reactionType || '').trim()
    const fieldByType = {
      heart: 'heartCount',
      support: 'supportCount',
      candle: 'candleCount'
    }
    const reactionField = fieldByType[reactionType]

    if (!reactionField) {
      res.status(400).json({ error: 'Onbekend reactietype.' })
      return
    }

    const existingIndex = (item.reactedUsers || []).findIndex((entry) => entry.userId === actorId)
    const existing = existingIndex >= 0 ? item.reactedUsers[existingIndex] : null

    if (existing?.reactionType === reactionType) {
      item.reactions[reactionField] = Math.max(0, (item.reactions?.[reactionField] || 0) - 1)
      item.reactedUsers.splice(existingIndex, 1)
    } else {
      if (existing?.reactionType) {
        const oldField = `${existing.reactionType}Count`
        item.reactions[oldField] = Math.max(0, (item.reactions?.[oldField] || 0) - 1)
        item.reactedUsers[existingIndex].reactionType = reactionType
      } else {
        item.reactedUsers.push({ userId: actorId, reactionType })
      }

      item.reactions[reactionField] = (item.reactions?.[reactionField] || 0) + 1
    }

    await item.save()
    res.json(item)
  } catch (error) {
    console.error('reactToPublicRoomContribution error:', error)
    res.status(500).json({ error: 'Kon reactie niet opslaan.' })
  }
})

router.post('/rooms/:id/contributions/:contributionId/comments', async (req, res) => {
  const auth = getOptionalAuth(req)

  try {
    const room = await findPublicRoom(req.params.id)
    if (!room) {
      res.status(404).json({ error: 'Publieke kamer niet gevonden.' })
      return
    }

    const ownerId = resolveOwnerId(room)

    const item = await RoomContribution.findOne({ _id: req.params.contributionId, roomId: room._id, ownerId })
    if (!item) {
      res.status(404).json({ error: 'Bijdrage niet gevonden.' })
      return
    }

    const text = String(req.body?.text || '').trim()
    const displayName = String(req.body?.displayName || auth?.email || 'Bezoeker').trim()

    if (!text) {
      res.status(400).json({ error: 'Commentaar mag niet leeg zijn.' })
      return
    }

    if (text.length > 500) {
      res.status(400).json({ error: 'Commentaar mag maximaal 500 tekens bevatten.' })
      return
    }

    item.comments.push({
      userId: auth?.userId || '',
      displayName,
      text
    })

    await item.save()
    res.json(item)
  } catch (error) {
    console.error('addPublicRoomContributionComment error:', error)
    res.status(500).json({ error: 'Kon commentaar niet opslaan.' })
  }
})

router.post('/rooms/:id/room-reactions', async (req, res) => {
  const auth = getOptionalAuth(req)
  const actorId = resolveActorId(req, req.body || {}, auth)

  if (!actorId) {
    res.status(400).json({ error: 'Bezoeker sleutel ontbreekt.' })
    return
  }

  try {
    const room = await findPublicRoom(req.params.id)
    if (!room) {
      res.status(404).json({ error: 'Publieke kamer niet gevonden.' })
      return
    }

    const reactionType = String(req.body?.reactionType || '').trim()
    const fieldByType = {
      heart: 'heartCount',
      support: 'supportCount',
      candle: 'candleCount'
    }
    const reactionField = fieldByType[reactionType]

    if (!reactionField) {
      res.status(400).json({ error: 'Onbekend reactietype.' })
      return
    }

    const existingIndex = (room.roomReactedUsers || []).findIndex((entry) => entry.userId === actorId)
    const existing = existingIndex >= 0 ? room.roomReactedUsers[existingIndex] : null

    if (existing?.reactionType === reactionType) {
      room.roomReactions[reactionField] = Math.max(0, (room.roomReactions?.[reactionField] || 0) - 1)
      room.roomReactedUsers.splice(existingIndex, 1)
    } else {
      if (existing?.reactionType) {
        const oldField = `${existing.reactionType}Count`
        room.roomReactions[oldField] = Math.max(0, (room.roomReactions?.[oldField] || 0) - 1)
        room.roomReactedUsers[existingIndex].reactionType = reactionType
      } else {
        room.roomReactedUsers.push({ userId: actorId, reactionType })
      }

      room.roomReactions[reactionField] = (room.roomReactions?.[reactionField] || 0) + 1
    }

    await room.save()
    res.json(room)
  } catch (error) {
    console.error('reactToPublicRoom error:', error)
    res.status(500).json({ error: 'Kon reactie niet opslaan.' })
  }
})

router.post('/rooms/:id/room-comments', async (req, res) => {
  const auth = getOptionalAuth(req)

  try {
    const room = await findPublicRoom(req.params.id)
    if (!room) {
      res.status(404).json({ error: 'Publieke kamer niet gevonden.' })
      return
    }

    const text = String(req.body?.text || '').trim()
    const displayName = String(req.body?.displayName || auth?.email || 'Bezoeker').trim()

    if (!text) {
      res.status(400).json({ error: 'Commentaar mag niet leeg zijn.' })
      return
    }

    if (text.length > 500) {
      res.status(400).json({ error: 'Commentaar mag maximaal 500 tekens bevatten.' })
      return
    }

    room.roomComments.push({
      userId: auth?.userId || '',
      displayName,
      text
    })

    await room.save()
    res.json(room)
  } catch (error) {
    console.error('addPublicRoomComment error:', error)
    res.status(500).json({ error: 'Kon commentaar niet opslaan.' })
  }
})

module.exports = router
