import { connectToDatabase } from '../../../../src/server/lib/mongodb.js'
import { User } from '../../../../src/server/models/User.js'
import { requireAuth, requireRole } from '../../../../src/server/middleware/authMiddleware.js'

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json')
}

export default async function handler(req, res) {
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
    console.error('MongoDB connection error:', error)
    res.status(500).json({ error: 'Databaseverbinding mislukt.' })
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
    console.error('listMyEditors error:', error)
    res.status(500).json({ error: 'Kon klanten niet ophalen.' })
  }
}
