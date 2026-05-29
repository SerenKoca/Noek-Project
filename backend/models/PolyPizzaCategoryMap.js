const mongoose = require('mongoose')

const polyPizzaCategoryMapSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'default',
      unique: true,
      index: true
    },
    categoryMap: {
      type: Object,
      default: {}
    }
      ,
      categories: {
        type: [String],
        default: []
      }
  },
  {
    timestamps: true
  }
)

module.exports = mongoose.models.PolyPizzaCategoryMap || mongoose.model('PolyPizzaCategoryMap', polyPizzaCategoryMapSchema)