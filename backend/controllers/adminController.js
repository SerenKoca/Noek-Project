const bcrypt = require('bcryptjs')
const User = require('../models/User')
const Room = require('../models/Room')
const PolyPizzaCategoryMap = require('../models/PolyPizzaCategoryMap')
const { normalizeTemplateKey, getTemplateRoomName } = require('../lib/templateRooms')

const DEFAULT_BRAND_DARK = '#1e2b37'
const DEFAULT_BRAND_LIGHT = '#d7e1eb'
const TEMPLATE_OWNER_EMAIL = String(
  process.env.ROOM_TEMPLATE_OWNER_EMAIL || process.env.VITE_ROOM_TEMPLATE_OWNER_EMAIL || 'editor@test.be'
).trim().toLowerCase()

function normalizeHexColor(input, fallback) {
  const value = String(input || '').trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(value) ? value : fallback
}

function sanitizeBranding(user) {
  return {
    logoUrl: String(user?.brandLogoUrl || '').trim(),
    darkColor: normalizeHexColor(user?.brandDarkColor, DEFAULT_BRAND_DARK),
    lightColor: normalizeHexColor(user?.brandLightColor, DEFAULT_BRAND_LIGHT)
  }
}

function sanitizeUser(user) {
  return {
    id: user._id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    funeralDirectorId: user.funeralDirectorId || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }
}

function buildFallbackTemplateSceneData() {
  return {
    templateSlots: [],
    furniture: [],
    appearance: {},
    metadata: {
      generatedAt: new Date().toISOString(),
      source: 'fallback-template'
    }
  }
}

const POLY_PIZZA_CATEGORY_KEY = 'default'

function normalizeCategoryList(value) {
  return [...new Set(
    (Array.isArray(value) ? value : [value])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .filter((item) => item !== 'Alle')
  )]
}

function normalizeCategoryMap(input = {}) {
  const categoryMap = {}

  for (const [modelId, value] of Object.entries(input || {})) {
    const id = String(modelId || '').trim()
    const categories = normalizeCategoryList(value)
    if (!id || !categories.length) continue
    categoryMap[id] = categories
  }

  return categoryMap
}

async function findTemplateRoom(templateKey) {
  const templateOwner = await User.findOne({ email: TEMPLATE_OWNER_EMAIL, role: { $in: ['editor', 'admin'] } })
  if (!templateOwner) return null

  const normalizedTemplateKey = normalizeTemplateKey(templateKey)
  if (normalizedTemplateKey === 'template-a') {
    return Room.findOne({
      ownerId: templateOwner._id,
      $or: [
        { templateKey: 'template-a' },
        { templateKey: '' },
        { templateKey: { $exists: false } }
      ]
    }).sort({ createdAt: 1 })
  }

  return Room.findOne({ ownerId: templateOwner._id, templateKey: normalizedTemplateKey }).sort({ createdAt: 1 })
}

exports.listFuneralDirectors = async (req, res) => {
  try {
    const users = await User.find({ role: 'funeral_director' }).sort({ createdAt: -1 })
    res.json(users.map(sanitizeUser))
  } catch (error) {
    console.error('listFuneralDirectors error:', error)
    res.status(500).json({ error: 'Kon uitvaartondernemers niet ophalen.' })
  }
}

exports.getFuneralDirectorDetails = async (req, res) => {
  try {
    const directorId = String(req.params?.id || '').trim()
    if (!directorId) {
      res.status(400).json({ error: 'Ongeldig account-id.' })
      return
    }

    const director = await User.findOne({ _id: directorId, role: 'funeral_director' })
    if (!director) {
      res.status(404).json({ error: 'Uitvaartondernemer niet gevonden.' })
      return
    }

    const editors = await User.find({ role: 'editor', funeralDirectorId: director._id }).sort({ createdAt: -1 })
    const editorIdSet = new Set(editors.map((item) => String(item._id)))
    const editorIdList = Array.from(editorIdSet)

    const rooms = editorIdList.length
      ? await Room.find({ ownerId: { $in: editorIdList } }).sort({ createdAt: -1 })
      : []

    const roomsByOwnerId = new Map()
    for (const room of rooms) {
      const ownerId = String(room.ownerId || '')
      if (!roomsByOwnerId.has(ownerId)) {
        roomsByOwnerId.set(ownerId, [])
      }
      roomsByOwnerId.get(ownerId).push({
        id: room._id,
        name: room.name,
        isPublic: room.isPublic,
        createdAt: room.createdAt
      })
    }

    const clients = editors.map((item) => {
      const key = String(item._id)
      const ownedRooms = roomsByOwnerId.get(key) || []

      return {
        id: item._id,
        email: item.email,
        displayName: item.displayName,
        createdAt: item.createdAt,
        roomCount: ownedRooms.length,
        rooms: ownedRooms
      }
    })

    res.json({
      director: sanitizeUser(director),
      branding: sanitizeBranding(director),
      stats: {
        clientCount: clients.length,
        roomCount: rooms.length
      },
      clients
    })
  } catch (error) {
    console.error('getFuneralDirectorDetails error:', error)
    res.status(500).json({ error: 'Kon details van uitvaartondernemer niet ophalen.' })
  }
}

exports.createFuneralDirector = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    const displayName = String(req.body?.displayName || '').trim()

    if (!email || !password || !displayName) {
      res.status(400).json({ error: 'Email, wachtwoord en naam zijn verplicht.' })
      return
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Wachtwoord moet minstens 8 tekens hebben.' })
      return
    }

    const exists = await User.findOne({ email })
    if (exists) {
      res.status(409).json({ error: 'Account met dit emailadres bestaat al.' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({
      email,
      passwordHash,
      displayName,
      role: 'funeral_director'
    })

    res.status(201).json(sanitizeUser(user))
  } catch (error) {
    console.error('createFuneralDirector error:', error)
    res.status(500).json({ error: 'Kon uitvaartondernemer niet aanmaken.' })
  }
}

exports.deleteFuneralDirector = async (req, res) => {
  try {
    const directorId = String(req.params?.id || '').trim()
    if (!directorId) {
      res.status(400).json({ error: 'Ongeldig account-id.' })
      return
    }

    const director = await User.findOne({ _id: directorId, role: 'funeral_director' })
    if (!director) {
      res.status(404).json({ error: 'Uitvaartondernemer niet gevonden.' })
      return
    }

    await User.deleteOne({ _id: directorId })

    await User.updateMany(
      { role: 'editor', funeralDirectorId: director._id },
      { $set: { funeralDirectorId: null } }
    )

    res.json({ message: 'Uitvaartondernemer verwijderd.' })
  } catch (error) {
    console.error('deleteFuneralDirector error:', error)
    res.status(500).json({ error: 'Kon uitvaartondernemer niet verwijderen.' })
  }
}

exports.getTemplateRoom = async (req, res) => {
  try {
    const templateKey = normalizeTemplateKey(req.query?.templateKey || req.query?.variant)
    const templateRoom = await findTemplateRoom(templateKey)

    if (templateRoom?.sceneData) {
      res.json({
        roomId: templateRoom._id,
        name: templateRoom.name || getTemplateRoomName(templateKey),
        templateKey,
        sceneData: templateRoom.sceneData,
        source: 'template-room'
      })
      return
    }

    res.json({
      roomId: '',
      name: getTemplateRoomName(templateKey),
      templateKey,
      sceneData: buildFallbackTemplateSceneData(),
      source: 'fallback-template'
    })
  } catch (error) {
    console.error('getTemplateRoom error:', error)
    res.status(500).json({ error: 'Kon template kamer niet ophalen.' })
  }
}

exports.updateTemplateRoom = async (req, res) => {
  try {
    const sceneData = req.body?.sceneData
    const templateKey = normalizeTemplateKey(req.body?.templateKey || req.query?.templateKey || req.query?.variant)
    if (!sceneData || typeof sceneData !== 'object') {
      res.status(400).json({ error: 'sceneData is verplicht.' })
      return
    }

    let templateRoom = await findTemplateRoom(templateKey)
    if (!templateRoom) {
      const templateOwner = await User.findOne({ email: TEMPLATE_OWNER_EMAIL, role: { $in: ['editor', 'admin'] } })
      if (!templateOwner) {
        res.status(404).json({ error: 'Template kamer niet gevonden.' })
        return
      }

      templateRoom = new Room({
        name: getTemplateRoomName(templateKey),
        ownerId: templateOwner._id,
        templateKey,
        isPublic: false,
        sceneData
      })
    } else {
      templateRoom.sceneData = sceneData
      templateRoom.templateKey = templateKey
    }

    await templateRoom.save()

    res.json({
      roomId: templateRoom._id,
      name: templateRoom.name || getTemplateRoomName(templateKey),
      templateKey,
      sceneData: templateRoom.sceneData,
      source: 'template-room'
    })
  } catch (error) {
    console.error('updateTemplateRoom error:', error)
    res.status(500).json({ error: 'Kon template kamer niet opslaan.' })
  }
}

exports.getPolyPizzaCategoryMap = async (req, res) => {
  try {
    const doc = await PolyPizzaCategoryMap.findOne({ key: POLY_PIZZA_CATEGORY_KEY })
    res.json({
      key: POLY_PIZZA_CATEGORY_KEY,
      categoryMap: doc?.categoryMap || {},
      categories: Array.isArray(doc?.categories) ? doc.categories : [],
      updatedAt: doc?.updatedAt || null
    })
  } catch (error) {
    console.error('getPolyPizzaCategoryMap error:', error)
    res.status(500).json({ error: 'Kon Poly Pizza categoriemap niet ophalen.' })
  }
}

exports.updatePolyPizzaCategoryMap = async (req, res) => {
  try {
    const categoryMap = normalizeCategoryMap(req.body?.categoryMap || {})
    const categories = normalizeCategoryList(req.body?.categories || req.body?.categoryList || [])
    const doc = await PolyPizzaCategoryMap.findOneAndUpdate(
      { key: POLY_PIZZA_CATEGORY_KEY },
      {
        key: POLY_PIZZA_CATEGORY_KEY,
        categoryMap,
        categories
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    )

    res.json({
      key: POLY_PIZZA_CATEGORY_KEY,
      categoryMap: doc.categoryMap || {},
      categories: Array.isArray(doc.categories) ? doc.categories : [],
      updatedAt: doc.updatedAt || null
    })
  } catch (error) {
    console.error('updatePolyPizzaCategoryMap error:', error)
    res.status(500).json({ error: 'Kon Poly Pizza categoriemap niet opslaan.' })
  }
}
