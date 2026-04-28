function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json')
}

function buildDiagnostics(req, extra = {}) {
  return {
    route: '/api/admin/funeral-directors',
    method: req.method,
    hasMongoUri: Boolean(process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL || process.env.DATABASE_URL),
    hasJwtSecret: Boolean(process.env.JWT_SECRET),
    ...extra
  }
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
    role: user.role,
    funeralDirectorId: user.funeralDirectorId || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }
}

function normalizePathSegments(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String)
  if (typeof value === 'string' && value.trim()) return value.split('/').filter(Boolean)
  return []
}

async function handleDelete(req, res, auth, directorId) {
  try {
    const [mongoModule, userModule] = await Promise.all([
      import('../../../src/server/lib/mongodb.js'),
      import('../../../src/server/models/User.js')
    ])

    const { connectToDatabase } = mongoModule
    const { User } = userModule

    await connectToDatabase()

    if (req.method !== 'DELETE') {
      res.setHeader('Allow', ['DELETE'])
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

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

    res.status(200).json({ message: 'Uitvaartondernemer verwijderd.' })
  } catch (error) {
    console.error('deleteFuneralDirector error:', error)
    res.status(500).json({ error: 'Kon uitvaartondernemer niet verwijderen.' })
  }
}

async function handleDetails(req, res, directorId) {
  try {
    const [mongoModule, userModule, roomModule] = await Promise.all([
      import('../../../src/server/lib/mongodb.js'),
      import('../../../src/server/models/User.js'),
      import('../../../backend/models/Room.js')
    ])

    const { connectToDatabase } = mongoModule
    const { User } = userModule
    const Room = roomModule.default

    await connectToDatabase()

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

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
    const editorIdList = Array.from(new Set(editors.map((item) => String(item._id))))

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

    res.status(200).json({
      director: sanitizeUser(director),
      branding: {
        logoUrl: String(director?.brandLogoUrl || '').trim(),
        darkColor: String(director?.brandDarkColor || '#1e2b37').trim(),
        lightColor: String(director?.brandLightColor || '#d7e1eb').trim()
      },
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

export default async function handler(req, res) {
  try {
    setJsonHeaders(res)

    const [bcryptModule, mongoModule, userModule, authModule] = await Promise.all([
      import('bcryptjs'),
      import('../../../src/server/lib/mongodb.js'),
      import('../../../src/server/models/User.js'),
      import('../../../src/server/middleware/authMiddleware.js')
    ])

    const bcrypt = bcryptModule.default
    const { connectToDatabase } = mongoModule
    const { User } = userModule
    const { requireAuth, requireRole } = authModule

    const auth = requireAuth(req, res)
    if (!auth) return
    if (!requireRole(auth, res, 'admin')) return
    const segments = normalizePathSegments(req.query.path)
    const directorId = segments.length > 0 ? segments[0] : null
    const subPath = segments.length > 1 ? segments[1] : null

    if (!directorId) {
      try {
        await connectToDatabase()
      } catch (error) {
        console.error('ADMIN_FUNERAL_DIRECTORS_DIAGNOSTIC connectToDatabase failed', buildDiagnostics(req, {
          stage: 'connectToDatabase',
          errorMessage: error?.message,
          errorName: error?.name
        }))
        if (error?.message === 'Missing MONGO_URI') {
          res.status(500).json({ error: 'Serverconfiguratie mist MONGO_URI.', code: 'MISSING_MONGO_URI' })
          return
        }
        res.status(500).json({
          error: 'Databaseverbinding mislukt.',
          code: 'MONGO_CONNECTION_FAILED'
        })
        return
      }

      if (req.method === 'GET') {
        try {
          const users = await User.find({ role: 'funeral_director' }).sort({ createdAt: -1 })
          res.status(200).json(users.map(sanitizeUser))
        } catch (error) {
          console.error('ADMIN_FUNERAL_DIRECTORS_DIAGNOSTIC list failed', buildDiagnostics(req, {
            stage: 'listFuneralDirectors',
            errorMessage: error?.message,
            errorName: error?.name
          }))
          res.status(500).json({
            error: 'Kon uitvaartondernemers niet ophalen.',
            code: 'LIST_FUNERAL_DIRECTORS_FAILED'
          })
        }
        return
      }

      if (req.method === 'POST') {
        try {
          const email = String(parseBody(req).email || '').trim().toLowerCase()
          const password = String(parseBody(req).password || '')
          const displayName = String(parseBody(req).displayName || '').trim()

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
          console.error('ADMIN_FUNERAL_DIRECTORS_DIAGNOSTIC create failed', buildDiagnostics(req, {
            stage: 'createFuneralDirector',
            errorMessage: error?.message,
            errorName: error?.name
          }))
          res.status(500).json({
            error: 'Kon uitvaartondernemer niet aanmaken.',
            code: 'CREATE_FUNERAL_DIRECTOR_FAILED'
          })
        }
        return
      }

      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

    if (!subPath && req.method === 'GET') {
      return handleDetails(req, res, directorId)
    }

    if (subPath === 'details' && req.method === 'GET') {
      return handleDetails(req, res, directorId)
    }

    if (!subPath && req.method === 'DELETE') {
      return handleDelete(req, res, auth, directorId)
    }

    if (subPath === 'details') {
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

    return handleDelete(req, res, auth, directorId)
  } catch (error) {
    console.error('ADMIN_FUNERAL_DIRECTORS_DIAGNOSTIC unhandled crash', buildDiagnostics(req, {
      stage: 'handler',
      errorMessage: error?.message,
      errorName: error?.name,
      stack: error?.stack
    }))

    if (!res.headersSent) {
      setJsonHeaders(res)
      res.status(500).json({
        error: 'Onverwachte serverfout.',
        code: 'ADMIN_HANDLER_CRASH'
      })
    }
  }
}
