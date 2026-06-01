import Room from '../../backend/models/Room.js'
import RoomContribution from '../../backend/models/RoomContribution.js'
import { User } from '../../src/server/models/User.js'
import { connectToDatabase } from '../../src/server/lib/mongodb.js'
import { getOptionalAuth } from '../../src/server/middleware/optionalAuth.js'
import { ROOM_TEMPLATE } from '../../src/services/roomTemplate.js'
import templateRoomsModule from '../../backend/lib/templateRooms.js'
import roomEditAuthModule from '../../backend/lib/roomEditAuth.js'

const { normalizeTemplateKey, getTemplateRoomName } = templateRoomsModule
const { createRoomEditKey, verifyRoomEditKey } = roomEditAuthModule

const ROOM_TEMPLATE_OWNER_EMAIL = String(
  process.env.ROOM_TEMPLATE_OWNER_EMAIL || process.env.VITE_ROOM_TEMPLATE_OWNER_EMAIL || 'editor@test.be'
).trim().toLowerCase()

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json')
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') return JSON.parse(req.body)
  return req.body
}

function countWords(value) {
  return (value || '').trim().split(/\s+/).filter(Boolean).length
}

function normalizePathSegments(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String)
  if (typeof value === 'string' && value.trim()) return value.split('/').filter(Boolean)
  return []
}

function readHeader(req, headerName) {
  const value = req?.headers?.[headerName] ?? req?.headers?.[headerName.toLowerCase()]
  if (Array.isArray(value)) return value[0] || ''
  return String(value || '')
}

async function findOwnedRoom(roomId, ownerId) {
  return Room.findOne({ _id: roomId, ownerId })
}

async function findOwnedContribution(roomId, ownerId, contributionId) {
  return RoomContribution.findOne({ _id: contributionId, roomId, ownerId })
}

async function resolveRoomAuth(req, roomId) {
  const tokenAuth = getOptionalAuth(req)
  if (tokenAuth?.userId) {
    return tokenAuth
  }

  const editKey = String(readHeader(req, 'x-room-edit-key') || req.query?.editKey || '').trim()
  if (!roomId || !editKey) {
    return null
  }

  if (!verifyRoomEditKey(roomId, editKey)) {
    return null
  }

  const room = await Room.findById(roomId).select('ownerId')
  if (!room) {
    return null
  }

  return {
    userId: room.ownerId || room._id.toString(),
    email: '',
    role: 'editor',
    editAccess: true
  }
}

function buildFallbackTemplateSceneData() {
  return {
    templateSlots: JSON.parse(JSON.stringify(ROOM_TEMPLATE?.slots || [])),
    furniture: [],
    appearance: {},
    metadata: {
      generatedAt: new Date().toISOString(),
      source: 'fallback-template'
    }
  }
}

function normalizeRoomReactionType(value) {
  const fieldByType = {
    heart: 'heartCount',
    support: 'supportCount',
    candle: 'candleCount'
  }
  const reactionType = String(value || '').trim()
  const reactionField = fieldByType[reactionType]
  return { reactionType, reactionField }
}

export default async function handler(req, res) {
  setJsonHeaders(res)

  try {
    await connectToDatabase()
  } catch (error) {
    console.error('MongoDB connection error:', error)
    res.status(500).json({ error: 'Databaseverbinding mislukt.' })
    return
  }

  const segments = normalizePathSegments(req.query.path)

  if (segments[0] === 'template' && segments.length === 1) {
    const auth = getOptionalAuth(req)
    if (!auth) {
      res.status(401).json({ error: 'Login vereist.' })
      return
    }

    if (auth.role !== 'editor') {
      res.status(403).json({ error: 'Alleen editors kunnen kamers beheren.' })
      return
    }

    try {
      const templateKey = normalizeTemplateKey(req.query?.templateKey || req.query?.variant)
      const templateOwner = await User.findOne({
        email: ROOM_TEMPLATE_OWNER_EMAIL,
        role: 'editor'
      })

      if (templateOwner) {
        const templateRoom = templateKey === 'template-a'
          ? await Room.findOne({
              ownerId: templateOwner._id,
              $or: [
                { templateKey: 'template-a' },
                { templateKey: '' },
                { templateKey: { $exists: false } }
              ]
            }).sort({ createdAt: 1 })
          : await Room.findOne({ ownerId: templateOwner._id, templateKey }).sort({ createdAt: 1 })
        if (templateRoom?.sceneData) {
          res.status(200).json({
            sceneData: templateRoom.sceneData,
            roomId: templateRoom._id,
            templateKey,
            name: templateRoom.name || getTemplateRoomName(templateKey),
            source: 'template-room'
          })
          return
        }
      }

      res.status(200).json({
        sceneData: buildFallbackTemplateSceneData(),
        templateKey,
        name: getTemplateRoomName(templateKey),
        source: 'fallback-template'
      })
    } catch (error) {
      console.error('getRoomTemplate error:', error)
      res.status(500).json({ error: 'Kon begintemplate niet ophalen.' })
    }
    return
  }

  const roomId = segments[0]

  if (!roomId) {
    res.status(400).json({ error: 'Kamer-ID ontbreekt.' })
    return
  }

  const action = segments.slice(1)
  const auth = await resolveRoomAuth(req, roomId)

  if (!auth) {
    res.status(401).json({ error: 'Login vereist.' })
    return
  }

  if (action.length === 0) {
    if (req.method === 'GET') {
      try {
        const room = await findOwnedRoom(roomId, auth.userId)
        if (!room) {
          res.status(404).json({ error: 'Kamer niet gevonden.' })
          return
        }

        res.status(200).json(room)
      } catch (error) {
        console.error('getRoomById error:', error)
        res.status(500).json({ error: 'Kon kamer niet ophalen.' })
      }
      return
    }

    if (req.method === 'PUT') {
      try {
        const { name, sceneData } = parseBody(req)

        const updates = {}
        if (typeof name === 'string' && name.trim()) {
          updates.name = name.trim()
        }
        if (sceneData) {
          updates.sceneData = sceneData
        }

        if (!Object.keys(updates).length) {
          res.status(400).json({ error: 'Minstens naam of sceneData is verplicht.' })
          return
        }

        const room = await Room.findOneAndUpdate(
          { _id: roomId, ownerId: auth.userId },
          updates,
          { returnDocument: 'after', runValidators: true }
        )

        if (!room) {
          res.status(404).json({ error: 'Kamer niet gevonden.' })
          return
        }

        res.status(200).json(room)
      } catch (error) {
        console.error('updateRoom error:', error)
        res.status(500).json({ error: 'Kon de kamer niet bijwerken.' })
      }
      return
    }

    if (req.method === 'DELETE') {
      try {
        const room = await Room.findOneAndDelete({ _id: roomId, ownerId: auth.userId })
        if (!room) {
          res.status(404).json({ error: 'Kamer niet gevonden.' })
          return
        }

        res.status(200).json({ message: 'Kamer verwijderd.' })
      } catch (error) {
        console.error('deleteRoom error:', error)
        res.status(500).json({ error: 'Kon kamer niet verwijderen.' })
      }
      return
    }

    res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const room = await findOwnedRoom(roomId, auth.userId)
  if (!room) {
    res.status(404).json({ error: 'Kamer niet gevonden.' })
    return
  }

  const [resource, contributionId, nestedAction] = action

  if (resource === 'edit-link' && !contributionId && !nestedAction) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST'])
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

    try {
      const room = await findOwnedRoom(roomId, auth.userId)
      if (!room) {
        res.status(404).json({ error: 'Kamer niet gevonden.' })
        return
      }

      if (!room.editKey) {
        room.editKey = createRoomEditKey(String(room._id))
        await room.save()
      }

      res.status(200).json({ editKey: room.editKey })
    } catch (error) {
      console.error('issueRoomEditLink error:', error)
      res.status(500).json({ error: 'Kon bewerklink niet maken.' })
    }
    return
  }

  if (resource === 'contributions' && !contributionId) {
    if (req.method === 'GET') {
      try {
        const items = await RoomContribution.find({ roomId: room._id, ownerId: auth.userId }).sort({ createdAt: -1 })
        res.status(200).json(items)
      } catch (error) {
        console.error('getRoomContributions error:', error)
        res.status(500).json({ error: 'Kon bijdragen niet ophalen.' })
      }
      return
    }

    if (req.method === 'POST') {
      try {
        const {
          type,
          giverName,
          tributeText = '',
          mediaUrl = '',
          externalUrl = '',
          platform = 'none'
        } = parseBody(req)

        if (!type || !giverName?.trim()) {
          res.status(400).json({ error: 'Type en naam van gever zijn verplicht.' })
          return
        }

        if ((type === 'photo' || type === 'video_file') && !mediaUrl.trim()) {
          res.status(400).json({ error: 'Media-URL is verplicht voor foto en video bestanden.' })
          return
        }

        if ((type === 'video_url' || type === 'music_url') && !externalUrl.trim()) {
          res.status(400).json({ error: 'Externe URL is verplicht voor muziek en video links.' })
          return
        }

        if (countWords(tributeText) > 150) {
          res.status(400).json({ error: 'Tekst mag maximaal 150 woorden bevatten.' })
          return
        }

        const item = new RoomContribution({
          roomId: room._id,
          ownerId: auth.userId,
          createdByUserId: auth.userId,
          type,
          giverName: giverName.trim(),
          tributeText: tributeText.trim(),
          mediaUrl: mediaUrl.trim(),
          externalUrl: externalUrl.trim(),
          platform
        })

        await item.save()
        res.status(201).json(item)
      } catch (error) {
        console.error('createRoomContribution error:', error)
        res.status(500).json({ error: 'Kon bijdrage niet opslaan.' })
      }
      return
    }

    res.setHeader('Allow', ['GET', 'POST'])
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  if (resource === 'contributions' && contributionId && nestedAction === 'reactions') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST'])
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

    try {
      const contribution = await findOwnedContribution(room._id, auth.userId, contributionId)
      if (!contribution) {
        res.status(404).json({ error: 'Bijdrage niet gevonden.' })
        return
      }

      const reactionType = String(parseBody(req).reactionType || '').trim()
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

      const userId = auth.userId
      const existingIndex = (contribution.reactedUsers || []).findIndex((entry) => entry.userId === userId)
      const existing = existingIndex >= 0 ? contribution.reactedUsers[existingIndex] : null

      if (existing?.reactionType === reactionType) {
        contribution.reactions[reactionField] = Math.max(0, (contribution.reactions?.[reactionField] || 0) - 1)
        contribution.reactedUsers.splice(existingIndex, 1)
      } else {
        if (existing?.reactionType) {
          const oldField = `${existing.reactionType}Count`
          contribution.reactions[oldField] = Math.max(0, (contribution.reactions?.[oldField] || 0) - 1)
          contribution.reactedUsers[existingIndex].reactionType = reactionType
        } else {
          contribution.reactedUsers.push({ userId, reactionType })
        }

        contribution.reactions[reactionField] = (contribution.reactions?.[reactionField] || 0) + 1
      }

      await contribution.save()
      res.status(200).json(contribution)
    } catch (error) {
      console.error('reactToRoomContribution error:', error)
      res.status(500).json({ error: 'Kon reactie niet opslaan.' })
    }
    return
  }

  if (resource === 'contributions' && contributionId && nestedAction === 'comments') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST'])
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

    try {
      const contribution = await findOwnedContribution(room._id, auth.userId, contributionId)
      if (!contribution) {
        res.status(404).json({ error: 'Bijdrage niet gevonden.' })
        return
      }

      const text = String(parseBody(req).text || '').trim()
      const displayName = String(parseBody(req).displayName || auth.email || 'Gebruiker').trim()

      if (!text) {
        res.status(400).json({ error: 'Commentaar mag niet leeg zijn.' })
        return
      }

      if (text.length > 500) {
        res.status(400).json({ error: 'Commentaar mag maximaal 500 tekens bevatten.' })
        return
      }

      contribution.comments.push({
        userId: auth.userId,
        displayName,
        text
      })

      await contribution.save()
      res.status(200).json(contribution)
    } catch (error) {
      console.error('addRoomContributionComment error:', error)
      res.status(500).json({ error: 'Kon commentaar niet opslaan.' })
    }
    return
  }

  if (resource === 'music') {
    if (req.method !== 'PATCH') {
      res.setHeader('Allow', ['PATCH'])
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

    try {
      const body = parseBody(req)
      const musicUrl = String(body.musicUrl || '').trim()
      const volumeRaw = Number(body.volume)
      const volume = Number.isFinite(volumeRaw) ? Math.min(1, Math.max(0, volumeRaw)) : 0.35

      room.ambience = { musicUrl, volume }
      await room.save()

      res.status(200).json(room)
    } catch (error) {
      console.error('updateRoomMusic error:', error)
      res.status(500).json({ error: 'Kon kamermuziek niet opslaan.' })
    }
    return
  }

  if (resource === 'room-reactions') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST'])
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

    try {
      const { reactionType, reactionField } = normalizeRoomReactionType(parseBody(req).reactionType)
      if (!reactionField) {
        res.status(400).json({ error: 'Onbekend reactietype.' })
        return
      }

      const userId = auth.userId
      const existingIndex = (room.roomReactedUsers || []).findIndex((entry) => entry.userId === userId)
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
          room.roomReactedUsers.push({ userId, reactionType })
        }

        room.roomReactions[reactionField] = (room.roomReactions?.[reactionField] || 0) + 1
      }

      await room.save()
      res.status(200).json(room)
    } catch (error) {
      console.error('reactToRoom error:', error)
      res.status(500).json({ error: 'Kon reactie niet opslaan.' })
    }
    return
  }

  if (resource === 'room-comments') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST'])
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

    try {
      const text = String(parseBody(req).text || '').trim()
      const displayName = String(parseBody(req).displayName || auth.email || 'Gebruiker').trim()

      if (!text) {
        res.status(400).json({ error: 'Commentaar mag niet leeg zijn.' })
        return
      }

      if (text.length > 500) {
        res.status(400).json({ error: 'Commentaar mag maximaal 500 tekens bevatten.' })
        return
      }

      room.roomComments.push({
        userId: auth.userId,
        displayName,
        text
      })

      await room.save()
      res.status(200).json(room)
    } catch (error) {
      console.error('addRoomComment error:', error)
      res.status(500).json({ error: 'Kon commentaar niet opslaan.' })
    }
    return
  }

  res.status(404).json({ error: 'Route niet gevonden.' })
}