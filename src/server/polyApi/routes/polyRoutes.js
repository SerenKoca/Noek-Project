import { handlePolyProxy } from '../controllers/polyController.js'
import { fetchPolyApiResource } from '../models/polyModel.js'

const API_BASE_PATH = '/api/poly-api'
const API_VERSION_PATH = '/v1.1'

export async function polyRouter(req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const { targetPath, search } = deriveTarget(req)

  if (targetPath === '/health') {
    await handleHealthCheck(res)
    return
  }

  await handlePolyProxy(req, res, { targetPath, search })
}

function deriveTarget(req) {
  const requestUrl = req?.url || '/'
  const url = new URL(requestUrl, 'http://localhost')

  const pathFromQuery = req?.query?.path
  if (Array.isArray(pathFromQuery) && pathFromQuery.length) {
    return {
      targetPath: `/${pathFromQuery.join('/')}`,
      search: url.search
    }
  }

  if (typeof pathFromQuery === 'string' && pathFromQuery.trim()) {
    return {
      targetPath: `/${pathFromQuery.trim()}`,
      search: url.search
    }
  }

  let relativePath = url.pathname.startsWith(API_BASE_PATH) ? url.pathname.slice(API_BASE_PATH.length) : url.pathname
  if (!relativePath || relativePath === '') relativePath = '/'
  return {
    targetPath: relativePath,
    search: url.search
  }
}

async function handleHealthCheck(res) {
  const checks = []

  checks.push(await runCheck({
    id: 'search-basic',
    path: `${API_VERSION_PATH}/search`,
    search: '?Limit=1&License=1',
    expectedStatus: 200
  }))

  for (const listId of resolveConfiguredListIds()) {
    checks.push(await runCheck({
      id: `list-${listId}`,
      path: `${API_VERSION_PATH}/list/${encodeURIComponent(listId)}`,
      search: '',
      expectedStatus: 200
    }))
  }

  const ok = checks.every((check) => check.ok)
  const report = {
    ok,
    timestamp: new Date().toISOString(),
    checks,
    hints: ok
      ? []
      : [
          'Controleer of POLYPIZZA_API_KEY correct is ingesteld op productie.',
          'Controleer VITE_POLYPIZZA_FURNITURE_LISTS op geldige lijst-IDs.',
          'Controleer of /api/poly-api routes effectief gedeployed zijn op Vercel.'
        ]
  }

  console.log('[poly-health] report', JSON.stringify(report, null, 2))

  res.status(ok ? 200 : 502).json(report)
}

async function runCheck({ id, path, search, expectedStatus }) {
  try {
    const result = await fetchPolyApiResource({
      path,
      search,
      acceptHeader: 'application/json',
      userAgent: 'PolyPizzaHealth/1.0'
    })

    const preview = getBodyPreview(result.body, result.headers?.['content-type'])
    return {
      id,
      ok: result.status === expectedStatus,
      status: result.status,
      path: `${path}${search || ''}`,
      contentType: result.headers?.['content-type'] || '',
      bodyPreview: preview
    }
  } catch (error) {
    return {
      id,
      ok: false,
      status: 0,
      path: `${path}${search || ''}`,
      error: error?.message || 'Unknown health-check error'
    }
  }
}

function getBodyPreview(buffer, contentType) {
  try {
    const text = Buffer.from(buffer || []).toString('utf8').trim()
    if (!text) return ''

    if (String(contentType || '').toLowerCase().includes('application/json')) {
      const parsed = JSON.parse(text)
      return JSON.stringify(parsed).slice(0, 280)
    }

    return text.slice(0, 280)
  } catch {
    return ''
  }
}

function resolveConfiguredListIds() {
  const raw = [
    process.env.VITE_POLYPIZZA_FURNITURE_LIST,
    process.env.VITE_POLYPIZZA_FURNITURE_LISTS,
    process.env.POLYPIZZA_FURNITURE_LIST,
    process.env.POLYPIZZA_FURNITURE_LISTS
  ]
    .filter(Boolean)
    .join(',')

  const ids = raw
    .split(/[\n,;]+/)
    .map((item) => extractListId(item))
    .filter(Boolean)

  return [...new Set(ids)]
}

function extractListId(value) {
  const input = String(value || '').trim()
  if (!input) return ''

  if (/^[A-Za-z0-9_-]{6,}$/.test(input)) {
    return input
  }

  try {
    const parsed = new URL(input)
    const parts = parsed.pathname.split('/').filter(Boolean)
    const listIndex = parts.findIndex((part) => part.toLowerCase() === 'list' || part.toLowerCase() === 'l')
    if (listIndex >= 0 && parts[listIndex + 1]) {
      return String(parts[listIndex + 1]).trim()
    }

    const bundleIndex = parts.findIndex((part) => part.toLowerCase() === 'bundle')
    if (bundleIndex >= 0 && parts[bundleIndex + 1]) {
      const slug = String(parts[bundleIndex + 1]).trim()
      return slug.split('-').filter(Boolean).pop() || ''
    }

    return String(parts[parts.length - 1] || '').trim()
  } catch {
    return ''
  }
}
