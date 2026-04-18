const bcrypt = require('bcryptjs')
const User = require('../models/User')
const { createToken } = require('../lib/auth')

const TEMP_EDITOR_REGISTRATION_CODE = '0000'

function sanitizeUser(user) {
  return {
    id: user._id,
    email: user.email,
    displayName: user.displayName,
    role: user.role || 'editor'
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

exports.authHandler = async (req, res) => {
  try {
    const { action, email, password, displayName, registrationCode, registerRole } = req.body || {}
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const rawPassword = String(password || '')

    if (!normalizedEmail || !rawPassword) {
      res.status(400).json({ error: 'Email en wachtwoord zijn verplicht.' })
      return
    }

    if (!isValidEmail(normalizedEmail)) {
      res.status(400).json({ error: 'Ongeldig emailadres.' })
      return
    }

    if (action === 'register') {
      const role = String(registerRole || 'editor').trim().toLowerCase() === 'visitor' ? 'visitor' : 'editor'

      if (rawPassword.length < 8) {
        res.status(400).json({ error: 'Wachtwoord moet minstens 8 tekens hebben.' })
        return
      }

      if (role === 'editor') {
        const code = String(registrationCode || '').trim()
        if (code !== TEMP_EDITOR_REGISTRATION_CODE) {
          res.status(403).json({ error: 'Ongeldige registratiecode.' })
          return
        }
      }

      const name = String(displayName || '').trim() || normalizedEmail.split('@')[0]

      const existing = await User.findOne({ email: normalizedEmail })
      if (existing) {
        res.status(409).json({ error: 'Account bestaat al.' })
        return
      }

      const passwordHash = await bcrypt.hash(rawPassword, 10)
      const user = await User.create({
        email: normalizedEmail,
        passwordHash,
        displayName: name,
        role
      })

      const token = createToken({ userId: String(user._id), email: user.email, role: user.role || 'editor' })
      res.status(201).json({ token, user: sanitizeUser(user) })
      return
    }

    if (action === 'login') {
      const user = await User.findOne({ email: normalizedEmail })
      if (!user) {
        res.status(401).json({ error: 'Onjuiste login.' })
        return
      }

      const ok = await bcrypt.compare(rawPassword, user.passwordHash)
      if (!ok) {
        res.status(401).json({ error: 'Onjuiste login.' })
        return
      }

      const token = createToken({ userId: String(user._id), email: user.email, role: user.role || 'editor' })
      res.status(200).json({ token, user: sanitizeUser(user) })
      return
    }

    res.status(400).json({ error: 'Gebruik action: register of login.' })
  } catch (error) {
    console.error('authHandler error:', error)
    if (error?.message === 'Missing MONGO_URI') {
      res.status(500).json({ error: 'Serverconfiguratie mist MONGO_URI.' })
      return
    }

    if (error?.message === 'Missing JWT_SECRET') {
      res.status(500).json({ error: 'Serverconfiguratie mist JWT_SECRET.' })
      return
    }
    res.status(500).json({ error: 'Authenticatie mislukt.' })
  }
}
