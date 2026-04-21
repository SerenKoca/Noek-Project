function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json')
}

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

export default async function handler(req, res) {
  try {
    setJsonHeaders(res)

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

    const [mongoModule, userModule, authModule] = await Promise.all([
      import('../../src/server/lib/mongodb.js'),
      import('../../src/server/models/User.js'),
      import('../../src/server/middleware/authMiddleware.js')
    ])

    const { connectToDatabase } = mongoModule
    const { User } = userModule
    const { requireAuth } = authModule

    const auth = requireAuth(req, res)
    if (!auth) return

    await connectToDatabase()

    const currentUser = await User.findById(auth.userId)
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

    res.status(200).json(buildBrandingResponse(director))
  } catch (error) {
    console.error('ME_BRANDING handler error:', error)
    if (!res.headersSent) {
      setJsonHeaders(res)
      res.status(500).json({ error: 'Kon branding niet ophalen.', code: 'ME_BRANDING_ERROR' })
    }
  }
}
