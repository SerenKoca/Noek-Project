const mongoose = require('mongoose');

function countWords(value) {
  return (value || '').trim().split(/\s+/).filter(Boolean).length;
}

const commentSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      default: ''
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const roomContributionSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true
    },
    ownerId: {
      type: String,
      required: true,
      index: true
    },
    createdByUserId: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['photo', 'video_file', 'video_url', 'music_url', 'candle'],
      required: true
    },
    giverName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    tributeText: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator: (value) => countWords(value) <= 150,
        message: 'Tekst mag maximaal 150 woorden bevatten.'
      }
    },
    mediaUrl: {
      type: String,
      default: ''
    },
    externalUrl: {
      type: String,
      default: ''
    },
    platform: {
      type: String,
      enum: ['none', 'youtube', 'spotify'],
      default: 'none'
    },
    reactions: {
      heartCount: { type: Number, default: 0, min: 0 },
      supportCount: { type: Number, default: 0, min: 0 },
      candleCount: { type: Number, default: 0, min: 0 }
    },
    comments: {
      type: [commentSchema],
      default: []
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

module.exports = mongoose.models.RoomContribution || mongoose.model('RoomContribution', roomContributionSchema);
