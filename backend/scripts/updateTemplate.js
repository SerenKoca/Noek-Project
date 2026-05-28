require('dotenv').config()
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const { normalizeTemplateKey, getTemplateRoomName } = require('../lib/templateRooms')

async function connectMongo() {
  const primaryMongoUri = process.env.MONGO_URI
  const fallbackMongoUri = 'mongodb://127.0.0.1:27017/noek'
  const uris = []
  if (primaryMongoUri) uris.push(primaryMongoUri)
  if (!uris.includes(fallbackMongoUri)) uris.push(fallbackMongoUri)

  for (const uri of uris) {
    try {
      await mongoose.connect(uri)
      console.log(`MongoDB connected (${uri === primaryMongoUri ? 'MONGO_URI' : 'local fallback'})`)
      return
    } catch (err) {
      console.error('Mongo connection failed for', uri, err.message)
    }
  }
  throw new Error('Could not connect to MongoDB')
}

async function run() {
  const jsonPath = process.argv[2]
  if (!jsonPath) {
    console.error('Usage: node updateTemplate.js <sceneData.json> [templateOwnerEmail] [templateKey]')
    process.exit(1)
  }

  const absolute = path.isAbsolute(jsonPath) ? jsonPath : path.join(process.cwd(), jsonPath)
  if (!fs.existsSync(absolute)) {
    console.error('File not found:', absolute)
    process.exit(1)
  }

  let sceneData = null
  try {
    sceneData = JSON.parse(fs.readFileSync(absolute, 'utf8'))
  } catch (err) {
    console.error('Invalid JSON:', err.message)
    process.exit(1)
  }

  const templateEmailArg = String(process.argv[3] || process.env.ROOM_TEMPLATE_OWNER_EMAIL || process.env.VITE_ROOM_TEMPLATE_OWNER_EMAIL || 'editor@test.be').trim().toLowerCase()
  const templateKey = normalizeTemplateKey(process.argv[4] || process.env.ROOM_TEMPLATE_KEY || 'template-a')

  await connectMongo()

  const User = require('../models/User')
  const Room = require('../models/Room')

  try {
    const templateOwner = await User.findOne({ email: templateEmailArg, role: { $in: ['editor', 'admin'] } })
    if (!templateOwner) {
      console.error('Template owner not found for email:', templateEmailArg)
      process.exit(1)
    }

    let templateRoom = templateKey === 'template-a'
      ? await Room.findOne({
          ownerId: templateOwner._id,
          $or: [
            { templateKey: 'template-a' },
            { templateKey: '' },
            { templateKey: { $exists: false } }
          ]
        }).sort({ createdAt: 1 })
      : await Room.findOne({ ownerId: templateOwner._id, templateKey }).sort({ createdAt: 1 })
    if (!templateRoom) {
      templateRoom = new Room({
        name: getTemplateRoomName(templateKey),
        ownerId: templateOwner._id,
        isPublic: false,
        templateKey,
        sceneData
      })
      await templateRoom.save()
      console.log('Created template room:', String(templateRoom._id))
    } else {
      templateRoom.sceneData = sceneData
      templateRoom.templateKey = templateKey
      await templateRoom.save()
      console.log('Template updated on room:', String(templateRoom._id))
    }
  } catch (err) {
    console.error('Error updating template:', err)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
  }
}

if (require.main === module) run()

module.exports = { run }
