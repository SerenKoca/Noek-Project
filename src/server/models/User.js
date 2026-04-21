import mongoose from 'mongoose'

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
    }
  },
  {
    timestamps: true
  }
)

export const User = mongoose.models.User || mongoose.model('User', userSchema)
