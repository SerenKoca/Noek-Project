import { handlePolyProxy } from '../controllers/polyController.js'

const API_BASE_PATH = '/api/poly-api'

export async function polyRouter(req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const { targetPath, search } = deriveTarget(req.url)
  await handlePolyProxy(req, res, { targetPath, search })
}

function deriveTarget(requestUrl) {
  const url = new URL(requestUrl, 'http://localhost')
  let relativePath = url.pathname.startsWith(API_BASE_PATH) ? url.pathname.slice(API_BASE_PATH.length) : url.pathname
  if (!relativePath || relativePath === '') relativePath = '/'
  return {
    targetPath: relativePath,
    search: url.search
  }
}
