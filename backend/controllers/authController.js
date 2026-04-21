const bcrypt = require('bcryptjs')
const User = require('../models/User')
const EditorRegistrationCode = require('../models/EditorRegistrationCode')
const { createToken } = require('../lib/auth')

const ALLOWED_REGISTER_ROLES = ['editor', 'visitor', 'admin']

function sanitizeUser(user) {
  return {
    id: user._id,
    email: user.email,
    displayName: user.displayName,
    role: user.role || 'editor',
    funeralDirectorId: user.funeralDirectorId || null
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function normalizeRegisterRole(value) {
  const normalized = String(value || 'editor').trim().toLowerCase()
  if (!ALLOWED_REGISTER_ROLES.includes(normalized)) return 'editor'
  return normalized
}

async function consumeEditorRegistrationCode(rawCode, userId) {
  const code = String(rawCode || '').trim().toUpperCase()
  if (!code) {
    return { ok: false, status: 400, error: 'Registratiecode is verplicht.' }
  }

  const item = await EditorRegistrationCode.findOne({ code })
  if (!item) {
    return { ok: false, status: 403, error: 'Ongeldige registratiecode.' }
  }

  if (item.usedAt || item.usedByUserId) {
    return { ok: false, status: 403, error: 'Registratiecode is al gebruikt.' }
  }

  if (item.expiresAt && item.expiresAt.getTime() < Date.now()) {
    return { ok: false, status: 403, error: 'Registratiecode is verlopen.' }
  }

  item.usedByUserId = userId
  item.usedAt = new Date()
  await item.save()

  return { ok: true, directorId: item.createdByDirectorId }
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
      const role = normalizeRegisterRole(registerRole)

      if (rawPassword.length < 8) {
        res.status(400).json({ error: 'Wachtwoord moet minstens 8 tekens hebben.' })
        return
      }

      if (role === 'admin') {
        const adminCode = String(process.env.ADMIN_REGISTRATION_CODE || '').trim()
        if (!adminCode || String(registrationCode || '').trim() !== adminCode) {
          res.status(403).json({ error: 'Admin registratiecode is ongeldig.' })
          return
        }
      }

      if (role === 'funeral_director') {
        res.status(403).json({ error: 'Uitvaartondernemers worden aangemaakt door een admin.' })
        return
      }

      const name = String(displayName || '').trim() || normalizedEmail.split('@')[0]

      const existing = await User.findOne({ email: normalizedEmail })
      if (existing) {
        res.status(409).json({ error: 'Account bestaat al.' })
        return
      }

      const passwordHash = await bcrypt.hash(rawPassword, 10)
      const userData = {
        email: normalizedEmail,
        passwordHash,
        displayName: name,
        role
      }

      if (role === 'editor') {
        const code = String(registrationCode || '').trim().toUpperCase()
        const matchingCode = await EditorRegistrationCode.findOne({ code })

        if (!matchingCode) {
          res.status(403).json({ error: 'Ongeldige registratiecode.' })
          return
        }

        if (matchingCode.usedAt || matchingCode.usedByUserId) {
          res.status(403).json({ error: 'Registratiecode is al gebruikt.' })
          return
        }

        if (matchingCode.expiresAt && matchingCode.expiresAt.getTime() < Date.now()) {
          res.status(403).json({ error: 'Registratiecode is verlopen.' })
          return
        }

        userData.funeralDirectorId = matchingCode.createdByDirectorId
      }

      const user = await User.create({
        ...userData
      })

      if (role === 'editor') {
        const consumeResult = await consumeEditorRegistrationCode(registrationCode, user._id)
        if (!consumeResult.ok) {
          await User.deleteOne({ _id: user._id })
          res.status(consumeResult.status).json({ error: consumeResult.error })
          return
        }
      }

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
