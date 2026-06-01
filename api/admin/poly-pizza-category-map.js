import PolyPizzaCategoryMap from '../../backend/models/PolyPizzaCategoryMap.js'
import { connectToDatabase } from '../../src/server/lib/mongodb.js'
import { requireAuth, requireRole } from '../../src/server/middleware/authMiddleware.js'

const POLY_PIZZA_CATEGORY_KEY = 'default'

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json')
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return req.body
}

function normalizeCategoryList(value) {
  return [...new Set(
    (Array.isArray(value) ? value : [value])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .filter((item) => item !== 'Alle')
  )]
}

function normalizeCategoryMap(input = {}) {
  const categoryMap = {}

  for (const [modelId, value] of Object.entries(input || {})) {
    const id = String(modelId || '').trim()
    const categories = normalizeCategoryList(value)
    if (!id || !categories.length) continue
    categoryMap[id] = categories
  }

  return categoryMap
}

export default async function handler(req, res) {
  setJsonHeaders(res)

  const auth = requireAuth(req, res)
  if (!auth) return
  if (!requireRole(auth, res, 'admin')) return

  try {
    await connectToDatabase()
  } catch (error) {
    console.error('ADMIN_POLY_PIZZA_CATEGORY_MAP connect error:', error)
    res.status(500).json({ error: 'Databaseverbinding mislukt.' })
    return
  }

  if (req.method === 'GET') {
    try {
      const doc = await PolyPizzaCategoryMap.findOne({ key: POLY_PIZZA_CATEGORY_KEY })
      res.status(200).json({
        key: POLY_PIZZA_CATEGORY_KEY,
        categoryMap: doc?.categoryMap || {},
        categories: Array.isArray(doc?.categories) ? doc.categories : [],
        updatedAt: doc?.updatedAt || null
      })
    } catch (error) {
      console.error('getPolyPizzaCategoryMap error:', error)
      res.status(500).json({ error: 'Kon Poly Pizza categoriemap niet ophalen.' })
    }
    return
  }

  if (req.method === 'PUT') {
    try {
      const body = parseBody(req)
      const categoryMap = normalizeCategoryMap(body?.categoryMap || {})
      const categories = normalizeCategoryList(body?.categories || body?.categoryList || [])

      const doc = await PolyPizzaCategoryMap.findOneAndUpdate(
        { key: POLY_PIZZA_CATEGORY_KEY },
        {
          key: POLY_PIZZA_CATEGORY_KEY,
          categoryMap,
          categories
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      )

      res.status(200).json({
        key: POLY_PIZZA_CATEGORY_KEY,
        categoryMap: doc.categoryMap || {},
        categories: Array.isArray(doc.categories) ? doc.categories : [],
        updatedAt: doc.updatedAt || null
      })
    } catch (error) {
      console.error('updatePolyPizzaCategoryMap error:', error)
      res.status(500).json({ error: 'Kon Poly Pizza categoriemap niet opslaan.' })
    }
    return
  }

  res.setHeader('Allow', ['GET', 'PUT'])
  res.status(405).json({ error: 'Method Not Allowed' })
}