import crypto from 'crypto'

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json')
}

function buildDiagnostics(req, extra = {}) {
  return {
    route: '/api/director/[...path]',
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

const DEFAULT_BRAND_DARK = '#1e2b37'
const DEFAULT_BRAND_LIGHT = '#d7e1eb'

function normalizeHexColor(input, fallback) {
  const value = String(input || '').trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(value) ? value : fallback
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

async function generateUniqueCode(EditorRegistrationCodeModel) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode(8)
    const exists = await EditorRegistrationCodeModel.findOne({ code })
    if (!exists) return code
  }

  throw new Error('Could not generate unique code')
}

// Handler for /api/director/branding
async function handleBranding(req, res, auth) {
  try {
    const [mongoModule, userModule] = await Promise.all([
      import('../../src/server/lib/mongodb.js'),
      import('../../src/server/models/User.js')
    ])

    const { connectToDatabase } = mongoModule
    const { User } = userModule

    await connectToDatabase()

    const director = await User.findOne({ _id: auth.userId, role: 'funeral_director' })
    if (!director) {
      res.status(404).json({ error: 'Uitvaartondernemer niet gevonden.' })
      return
    }

    if (req.method === 'GET') {
      res.status(200).json({
        logoUrl: String(director?.brandLogoUrl || '').trim(),
        darkColor: normalizeHexColor(director?.brandDarkColor, DEFAULT_BRAND_DARK),
        lightColor: normalizeHexColor(director?.brandLightColor, DEFAULT_BRAND_LIGHT),
        directorName: String(director?.displayName || '').trim()
      })
      return
    }

    if (req.method === 'PUT') {
      const body = parseBody(req)
      director.brandLogoUrl = String(body.logoUrl || '').trim().slice(0, 2048)
      director.brandDarkColor = normalizeHexColor(body.darkColor, DEFAULT_BRAND_DARK)
      director.brandLightColor = normalizeHexColor(body.lightColor, DEFAULT_BRAND_LIGHT)
      await director.save()

      res.status(200).json({
        logoUrl: String(director?.brandLogoUrl || '').trim(),
        darkColor: normalizeHexColor(director?.brandDarkColor, DEFAULT_BRAND_DARK),
        lightColor: normalizeHexColor(director?.brandLightColor, DEFAULT_BRAND_LIGHT),
        directorName: String(director?.displayName || '').trim()
      })
      return
    }

    res.setHeader('Allow', ['GET', 'PUT'])
    res.status(405).json({ error: 'Method Not Allowed' })
  } catch (error) {
    console.error('DIRECTOR_BRANDING handler error:', error)
    if (!res.headersSent) {
      setJsonHeaders(res)
      res.status(500).json({ error: 'Kon branding niet verwerken.', code: 'DIRECTOR_BRANDING_ERROR' })
    }
  }
}

// Handler for /api/director/editors
async function handleEditors(req, res, auth) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

    const [mongoModule, userModule] = await Promise.all([
      import('../../src/server/lib/mongodb.js'),
      import('../../src/server/models/User.js')
    ])

    const { connectToDatabase } = mongoModule
    const { User } = userModule

    try {
      await connectToDatabase()
    } catch (error) {
      console.error('DIRECTOR_EDITORS_DIAGNOSTIC connectToDatabase failed', buildDiagnostics(req, {
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

    try {
      const items = await User.find({ role: 'editor', funeralDirectorId: auth.userId }).sort({ createdAt: -1 })
      res.status(200).json(
        items.map((item) => ({
          id: item._id,
          email: item.email,
          displayName: item.displayName,
          role: item.role,
          createdAt: item.createdAt
        }))
      )
    } catch (error) {
      console.error('DIRECTOR_EDITORS_DIAGNOSTIC listMyEditors failed', buildDiagnostics(req, {
        stage: 'listMyEditors',
        userId: auth.userId,
        errorMessage: error?.message,
        errorName: error?.name
      }))
      res.status(500).json({
        error: 'Kon klanten niet ophalen.',
        code: 'LIST_MY_EDITORS_FAILED'
      })
    }
  } catch (error) {
    console.error('DIRECTOR_EDITORS_DIAGNOSTIC unhandled crash', buildDiagnostics(req, {
      stage: 'handler',
      errorMessage: error?.message,
      errorName: error?.name,
      stack: error?.stack
    }))

    if (!res.headersSent) {
      setJsonHeaders(res)
      res.status(500).json({
        error: 'Onverwachte serverfout.',
        code: 'DIRECTOR_EDITORS_HANDLER_CRASH'
      })
    }
  }
}

// Handler for /api/director/editor-codes
async function handleEditorCodes(req, res, auth) {
  try {
    const [mongoModule, editorCodeModule] = await Promise.all([
      import('../../src/server/lib/mongodb.js'),
      import('../../src/server/models/EditorRegistrationCode.js')
    ])

    const { connectToDatabase } = mongoModule
    const { EditorRegistrationCode } = editorCodeModule

    try {
      await connectToDatabase()
    } catch (error) {
      console.error('DIRECTOR_EDITOR_CODES_DIAGNOSTIC connectToDatabase failed', buildDiagnostics(req, {
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
        console.error('DIRECTOR_EDITOR_CODES_DIAGNOSTIC list failed', buildDiagnostics(req, {
          stage: 'listMyEditorCodes',
          userId: auth.userId,
          errorMessage: error?.message,
          errorName: error?.name
        }))
        res.status(500).json({
          error: 'Kon registratiecodes niet ophalen.',
          code: 'LIST_EDITOR_CODES_FAILED'
        })
      }
      return
    }

    if (req.method === 'POST') {
      try {
        const expiresInDaysRaw = Number(parseBody(req).expiresInDays)
        const expiresInDays = Number.isFinite(expiresInDaysRaw) ? Math.max(1, Math.min(365, Math.round(expiresInDaysRaw))) : 30

        const code = await generateUniqueCode(EditorRegistrationCode)
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
        console.error('DIRECTOR_EDITOR_CODES_DIAGNOSTIC create failed', buildDiagnostics(req, {
          stage: 'generateEditorCode',
          userId: auth.userId,
          errorMessage: error?.message,
          errorName: error?.name
        }))
        res.status(500).json({
          error: 'Kon registratiecode niet aanmaken.',
          code: 'GENERATE_EDITOR_CODE_FAILED'
        })
      }
      return
    }

    res.setHeader('Allow', ['GET', 'POST'])
    res.status(405).json({ error: 'Method Not Allowed' })
  } catch (error) {
    console.error('DIRECTOR_EDITOR_CODES_DIAGNOSTIC unhandled crash', buildDiagnostics(req, {
      stage: 'handler',
      errorMessage: error?.message,
      errorName: error?.name,
      stack: error?.stack
    }))

    if (!res.headersSent) {
      setJsonHeaders(res)
      res.status(500).json({
        error: 'Onverwachte serverfout.',
        code: 'DIRECTOR_EDITOR_CODES_HANDLER_CRASH'
      })
    }
  }
}

export default async function handler(req, res) {
  try {
    setJsonHeaders(res)

    const [authModule] = await Promise.all([
      import('../../src/server/middleware/authMiddleware.js')
    ])

    const { requireAuth, requireRole } = authModule

    const auth = requireAuth(req, res)
    if (!auth) return
    if (!requireRole(auth, res, 'funeral_director')) return

    // Extract the path segment from req.url
    const url = new URL(req.url || '/', 'http://localhost')
    const pathname = url.pathname
    const basePath = '/api/director'
    const remaining = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : ''
    const segments = remaining.split('/').filter(Boolean)
    const path = segments[0] || ''

    if (path === 'branding') {
      return handleBranding(req, res, auth)
    }

    if (path === 'editor-codes') {
      return handleEditorCodes(req, res, auth)
    }

    if (path === 'editors') {
      return handleEditors(req, res, auth)
    }

    res.status(404).json({ error: 'Endpoint niet gevonden.' })
  } catch (error) {
    console.error('DIRECTOR_HANDLER unhandled crash', buildDiagnostics(req, {
      stage: 'main handler',
      errorMessage: error?.message,
      errorName: error?.name,
      stack: error?.stack
    }))

    if (!res.headersSent) {
      setJsonHeaders(res)
      res.status(500).json({
        error: 'Onverwachte serverfout.',
        code: 'DIRECTOR_HANDLER_CRASH'
      })
    }
  }
}
