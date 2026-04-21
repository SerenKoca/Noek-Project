require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const User = require('../models/User')

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function connectMongo() {
  const primaryMongoUri = process.env.MONGO_URI
  const fallbackMongoUri = 'mongodb://127.0.0.1:27017/noek'
  const attemptedUris = []

  if (primaryMongoUri) attemptedUris.push(primaryMongoUri)
  if (!attemptedUris.includes(fallbackMongoUri)) attemptedUris.push(fallbackMongoUri)

  let lastError = null

  for (const uri of attemptedUris) {
    try {
      await mongoose.connect(uri)
      console.log(`MongoDB connected (${uri === primaryMongoUri ? 'MONGO_URI' : 'local fallback'})`)
      return
    } catch (error) {
      lastError = error
      console.error(`MongoDB connection failed for ${uri === primaryMongoUri ? 'MONGO_URI' : 'local fallback'}:`, error.message)
    }
  }

  throw lastError
}

async function seedAdmin() {
  const email = String(process.env.ADMIN_SEED_EMAIL || '').trim().toLowerCase()
  const password = String(process.env.ADMIN_SEED_PASSWORD || '')
  const displayName = String(process.env.ADMIN_SEED_DISPLAY_NAME || 'Super Admin').trim()
  const forcePasswordReset = String(process.env.ADMIN_SEED_RESET_PASSWORD || '').trim().toLowerCase() === 'true'

  if (!email || !password) {
    throw new Error('ADMIN_SEED_EMAIL en ADMIN_SEED_PASSWORD zijn verplicht.')
  }

  if (!isValidEmail(email)) {
    throw new Error('ADMIN_SEED_EMAIL is ongeldig.')
  }

  if (password.length < 8) {
    throw new Error('ADMIN_SEED_PASSWORD moet minstens 8 tekens hebben.')
  }

  const existing = await User.findOne({ email })

  if (existing) {
    let changed = false

    if (existing.role !== 'admin') {
      existing.role = 'admin'
      changed = true
    }

    if (displayName && existing.displayName !== displayName) {
      existing.displayName = displayName
      changed = true
    }

    if (forcePasswordReset) {
      existing.passwordHash = await bcrypt.hash(password, 10)
      changed = true
    }

    if (changed) {
      await existing.save()
      console.log('Bestaand account geupdate naar admin:', email)
    } else {
      console.log('Admin account bestaat al en is up-to-date:', email)
    }

    return
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await User.create({
    email,
    passwordHash,
    displayName: displayName || email.split('@')[0],
    role: 'admin'
  })

  console.log('Admin account aangemaakt:', email)
}

async function run() {
  try {
    await connectMongo()
    await seedAdmin()
  } catch (error) {
    console.error('seedAdmin failed:', error.message)
    process.exitCode = 1
  } finally {
    await mongoose.connection.close()
  }
}

if (require.main === module) {
  run()
}

module.exports = {
  seedAdmin
}
