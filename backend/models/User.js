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
      enum: ['admin', 'funeral_director', 'editor', 'visitor'],
      default: 'editor',
      index: true
    },
    funeralDirectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    brandLogoUrl: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2048
    },
    brandDarkColor: {
      type: String,
      default: '#1e2b37',
      trim: true,
      lowercase: true,
      maxlength: 7
    },
    brandLightColor: {
      type: String,
      default: '#d7e1eb',
      trim: true,
      lowercase: true,
      maxlength: 7
    }
  },
  {
    timestamps: true
  }
)

module.exports = mongoose.models.User || mongoose.model('User', userSchema)
