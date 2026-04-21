function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json')
}

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

export default async function handler(req, res) {
  try {
    setJsonHeaders(res)

    const [mongoModule, userModule, authModule] = await Promise.all([
      import('../../src/server/lib/mongodb.js'),
      import('../../src/server/models/User.js'),
      import('../../src/server/middleware/authMiddleware.js')
    ])

    const { connectToDatabase } = mongoModule
    const { User } = userModule
    const { requireAuth, requireRole } = authModule

    const auth = requireAuth(req, res)
    if (!auth) return
    if (!requireRole(auth, res, 'funeral_director')) return

    await connectToDatabase()

    const director = await User.findOne({ _id: auth.userId, role: 'funeral_director' })
    if (!director) {
      res.status(404).json({ error: 'Uitvaartondernemer niet gevonden.' })
      return
    }

    if (req.method === 'GET') {
      res.status(200).json(sanitizeBranding(director))
      return
    }

    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
      director.brandLogoUrl = String(body.logoUrl || '').trim().slice(0, 2048)
      director.brandDarkColor = normalizeHexColor(body.darkColor, DEFAULT_BRAND_DARK)
      director.brandLightColor = normalizeHexColor(body.lightColor, DEFAULT_BRAND_LIGHT)
      await director.save()

      res.status(200).json(sanitizeBranding(director))
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
