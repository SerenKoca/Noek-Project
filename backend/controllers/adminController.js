const bcrypt = require('bcryptjs')
const User = require('../models/User')

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

exports.listFuneralDirectors = async (req, res) => {
  try {
    const users = await User.find({ role: 'funeral_director' }).sort({ createdAt: -1 })
    res.json(users.map(sanitizeUser))
  } catch (error) {
    console.error('listFuneralDirectors error:', error)
    res.status(500).json({ error: 'Kon uitvaartondernemers niet ophalen.' })
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
