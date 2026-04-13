import bcrypt from 'bcryptjs'
import { connectToDatabase } from '../../../src/server/lib/mongodb.js'
import { createToken } from '../../../src/server/lib/auth.js'
import { User } from '../../../src/server/models/User.js'

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json')
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    return JSON.parse(req.body)
  }
  return req.body
}

function sanitizeUser(user) {
  return {
    id: user._id,
    email: user.email,
    displayName: user.displayName
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default async function handler(req, res) {
  setJsonHeaders(res)

  try {
    await connectToDatabase()
  } catch (error) {
    console.error('MongoDB connection error:', error)
    if (error?.message === 'Missing MONGO_URI') {
      res.status(500).json({ error: 'Serverconfiguratie mist MONGO_URI.' })
      return
    }

    res.status(500).json({ error: 'Databaseverbinding mislukt.' })
    return
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  try {
    const { action, email, password, displayName } = parseBody(req)
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
      if (rawPassword.length < 8) {
        res.status(400).json({ error: 'Wachtwoord moet minstens 8 tekens hebben.' })
        return
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
        displayName: name
      })

      const token = createToken({ userId: String(user._id), email: user.email })

      res.status(201).json({
        token,
        user: sanitizeUser(user)
      })
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

      const token = createToken({ userId: String(user._id), email: user.email })

      res.status(200).json({
        token,
        user: sanitizeUser(user)
      })
      return
    }

    res.status(400).json({ error: 'Gebruik action: register of login.' })
  } catch (error) {
    console.error('auth handler error:', error)
    if (error?.message === 'Missing JWT_SECRET') {
      res.status(500).json({ error: 'Serverconfiguratie mist JWT_SECRET.' })
      return
    }
    res.status(500).json({ error: 'Authenticatie mislukt.' })
  }
}
