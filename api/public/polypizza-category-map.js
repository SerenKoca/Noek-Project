import PolyPizzaCategoryMap from '../../backend/models/PolyPizzaCategoryMap.js'
import { connectToDatabase } from '../../src/server/lib/mongodb.js'

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json')
}

export default async function handler(req, res) {
  setJsonHeaders(res)

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  try {
    await connectToDatabase()
    const doc = await PolyPizzaCategoryMap.findOne({ key: 'default' })

    res.status(200).json({
      key: 'default',
      categoryMap: doc?.categoryMap || {},
      categories: Array.isArray(doc?.categories) ? doc.categories : [],
      updatedAt: doc?.updatedAt || null
    })
  } catch (error) {
    console.error('getPolyPizzaCategoryMap error:', error)
    res.status(500).json({ error: 'Kon Poly Pizza categoriemap niet ophalen.' })
  }
}
