const mongoose = require('mongoose')

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    role: {
      type: String,
      enum: ['editor', 'visitor'],
      default: 'editor',
      index: true
    }
  },
  {
    timestamps: true
  }
)

module.exports = mongoose.models.User || mongoose.model('User', userSchema)
