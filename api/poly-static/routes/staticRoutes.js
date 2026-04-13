import { handlePolyStatic } from '../controllers/staticController.js'

const STATIC_BASE_PATH = '/api/poly-static'

export async function staticRouter(req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const { targetPath, search } = deriveTarget(req.url)
  await handlePolyStatic(req, res, { targetPath, search })
}

function deriveTarget(requestUrl) {
  const url = new URL(requestUrl, 'http://localhost')
  let relativePath = url.pathname.startsWith(STATIC_BASE_PATH) ? url.pathname.slice(STATIC_BASE_PATH.length) : url.pathname
  if (!relativePath || relativePath === '') relativePath = '/'
  return {
    targetPath: relativePath,
    search: url.search
  }
}
