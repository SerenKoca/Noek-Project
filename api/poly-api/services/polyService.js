import { fetchPolyApiResource } from '../models/polyModel.js'

export async function proxyPolyApiRequest({ targetPath, search, acceptHeader, userAgent }) {
  const normalizedPath = normalizePath(targetPath)
  const searchSuffix = typeof search === 'string' ? search : ''

  return fetchPolyApiResource({
    path: normalizedPath,
    search: searchSuffix,
    acceptHeader,
    userAgent
  })
}

function normalizePath(path) {
  if (!path || path === '') return '/'
  return path.startsWith('/') ? path : `/${path}`
}
