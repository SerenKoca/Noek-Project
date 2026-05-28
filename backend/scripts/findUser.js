require('dotenv').config()
const mongoose = require('mongoose')

async function run(email) {
  if (!email) {
    console.error('Usage: node findUser.js <email>')
    process.exit(1)
  }

  const primary = process.env.MONGO_URI
  if (!primary) {
    console.error('MONGO_URI not set in backend/.env')
    process.exit(1)
  }

  await mongoose.connect(primary)
  const User = require('../models/User')
  const user = await User.findOne({ email: String(email).trim().toLowerCase() })
  if (!user) {
    console.log('No user found with email:', email)
  } else {
    console.log('User:', { id: String(user._id), email: user.email, role: user.role })
  }
  await mongoose.connection.close()
}

if (require.main === module) run(process.argv[2])
