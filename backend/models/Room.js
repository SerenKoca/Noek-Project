const mongoose = require('mongoose');

const roomCommentSchema = new mongoose.Schema(
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

const roomReactionUserSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true
    },
    reactionType: {
      type: String,
      enum: ['heart', 'support', 'candle'],
      required: true
    }
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  editKey: {
    type: String,
    default: '',
    index: true
  },
  userId: {
    type: String,
    default: null
  },
  ownerId: {
    type: String,
    default: null,
    index: true
  },
  templateKey: {
    type: String,
    default: '',
    index: true
  },
  isPublic: {
    type: Boolean,
    default: true,
    index: true
  },
  sceneData: {
    type: Object,
    required: true
  },
  ambience: {
    musicUrl: {
      type: String,
      default: ''
    },
    volume: {
      type: Number,
      default: 0.35,
      min: 0,
      max: 1
    }
  },
  roomReactions: {
    heartCount: { type: Number, default: 0, min: 0 },
    supportCount: { type: Number, default: 0, min: 0 },
    candleCount: { type: Number, default: 0, min: 0 }
  },
  roomReactedUsers: {
    type: [roomReactionUserSchema],
    default: []
  },
  roomComments: {
    type: [roomCommentSchema],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Room', roomSchema);
