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
  if (!requireRole(auth, res, 'admin')) return

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE'])
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
    const directorId = String(req.query?.id || '').trim()
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
