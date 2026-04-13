import { fetchPolyStaticAsset } from '../models/staticModel.js'

export async function proxyPolyStaticRequest({ targetPath, search, acceptHeader, userAgent }) {
  const normalizedPath = normalizePath(targetPath)
  const searchSuffix = typeof search === 'string' ? search : ''

  return fetchPolyStaticAsset({
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
