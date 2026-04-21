const mongoose = require('mongoose')

const editorRegistrationCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    createdByDirectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    usedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    usedAt: {
      type: Date,
      default: null
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
)

module.exports = mongoose.models.EditorRegistrationCode || mongoose.model('EditorRegistrationCode', editorRegistrationCodeSchema)
