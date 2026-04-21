import { connectToDatabase } from '../../../../src/server/lib/mongodb.js'
import { User } from '../../../../src/server/models/User.js'
import { requireAuth, requireRole } from '../../../../src/server/middleware/authMiddleware.js'

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json')
}

function buildDiagnostics(req, extra = {}) {
  return {
    route: '/api/director/editors',
    method: req.method,
    hasMongoUri: Boolean(process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL || process.env.DATABASE_URL),
    hasJwtSecret: Boolean(process.env.JWT_SECRET),
    ...extra
  }
}

export default async function handler(req, res) {
  try {
    setJsonHeaders(res)

    const auth = requireAuth(req, res)
    if (!auth) return
    if (!requireRole(auth, res, 'funeral_director')) return

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

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
        code: 'MONGO_CONNECTION_FAILED',
        details: error?.message || 'Unknown database error'
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
        code: 'LIST_MY_EDITORS_FAILED',
        details: error?.message || 'Unknown list error'
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
        code: 'DIRECTOR_EDITORS_HANDLER_CRASH',
        details: error?.message || 'Unhandled serverless error'
      })
    }
  }
}
