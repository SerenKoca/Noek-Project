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

function buildDiagnostics(req, extra = {}) {
  return {
    route: '/api/auth',
    method: req.method,
    hasMongoUri: Boolean(process.env.MONGO_URI),
    hasJwtSecret: Boolean(process.env.JWT_SECRET),
    userAgent: req.headers?.['user-agent'] || null,
    origin: req.headers?.origin || null,
    ...extra
  }
}

export default async function handler(req, res) {
  setJsonHeaders(res)

  try {
    await connectToDatabase()
  } catch (error) {
    console.error('AUTH_DIAGNOSTIC connectToDatabase failed', buildDiagnostics(req, {
      stage: 'connectToDatabase',
      errorMessage: error?.message,
      errorName: error?.name,
      stack: error?.stack
    }))
    if (error?.message === 'Missing MONGO_URI') {
      res.status(500).json({ error: 'Serverconfiguratie mist MONGO_URI.', code: 'MISSING_MONGO_URI' })
      return
    }

    res.status(500).json({ error: 'Databaseverbinding mislukt.', code: 'MONGO_CONNECTION_FAILED' })
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

    console.log('AUTH_DIAGNOSTIC request received', buildDiagnostics(req, {
      stage: 'validation',
      action: action || null,
      emailDomain: normalizedEmail.includes('@') ? normalizedEmail.split('@')[1] : null,
      hasPassword: Boolean(rawPassword),
      displayNameProvided: Boolean(String(displayName || '').trim())
    }))

    if (!normalizedEmail || !rawPassword) {
      console.warn('AUTH_DIAGNOSTIC validation failed', buildDiagnostics(req, {
        stage: 'validation',
        reason: 'missing_email_or_password',
        action: action || null,
        emailProvided: Boolean(normalizedEmail),
        passwordProvided: Boolean(rawPassword)
      }))
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
        console.warn('AUTH_DIAGNOSTIC register conflict', buildDiagnostics(req, {
          stage: 'register',
          reason: 'user_exists',
          emailDomain: normalizedEmail.split('@')[1] || null
        }))
        res.status(409).json({ error: 'Account bestaat al.' })
        return
      }

      const passwordHash = await bcrypt.hash(rawPassword, 10)
      const user = await User.create({
        email: normalizedEmail,
        passwordHash,
        displayName: name
      })

      console.log('AUTH_DIAGNOSTIC register success', buildDiagnostics(req, {
        stage: 'register',
        userId: String(user._id),
        emailDomain: normalizedEmail.split('@')[1] || null
      }))

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
        console.warn('AUTH_DIAGNOSTIC login failed', buildDiagnostics(req, {
          stage: 'login',
          reason: 'user_not_found',
          emailDomain: normalizedEmail.split('@')[1] || null
        }))
        res.status(401).json({ error: 'Onjuiste login.' })
        return
      }

      const ok = await bcrypt.compare(rawPassword, user.passwordHash)
      if (!ok) {
        console.warn('AUTH_DIAGNOSTIC login failed', buildDiagnostics(req, {
          stage: 'login',
          reason: 'invalid_password',
          emailDomain: normalizedEmail.split('@')[1] || null,
          userId: String(user._id)
        }))
        res.status(401).json({ error: 'Onjuiste login.' })
        return
      }

      console.log('AUTH_DIAGNOSTIC login success', buildDiagnostics(req, {
        stage: 'login',
        userId: String(user._id),
        emailDomain: normalizedEmail.split('@')[1] || null
      }))

      const token = createToken({ userId: String(user._id), email: user.email })

      res.status(200).json({
        token,
        user: sanitizeUser(user)
      })
      return
    }

    res.status(400).json({ error: 'Gebruik action: register of login.' })
  } catch (error) {
    console.error('AUTH_DIAGNOSTIC auth handler crashed', buildDiagnostics(req, {
      stage: 'handler',
      errorMessage: error?.message,
      errorName: error?.name,
      stack: error?.stack
    }))
    if (error?.message === 'Missing JWT_SECRET') {
      res.status(500).json({ error: 'Serverconfiguratie mist JWT_SECRET.', code: 'MISSING_JWT_SECRET' })
      return
    }
    res.status(500).json({ error: 'Authenticatie mislukt.', code: 'AUTH_HANDLER_ERROR' })
  }
}
