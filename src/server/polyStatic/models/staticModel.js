const STATIC_ORIGIN = 'https://static.poly.pizza'
const PASS_HEADERS = ['cache-control', 'content-type', 'content-length']

export async function fetchPolyStaticAsset({ path, search, acceptHeader, userAgent }) {
  const url = `${STATIC_ORIGIN}${path}${search}`
  const normalizedAccept = resolveAcceptHeader(path, acceptHeader)
  const normalizedUserAgent =
    typeof userAgent === 'string' && userAgent.trim()
      ? userAgent
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

  const upstream = await fetch(url, {
    method: 'GET',
    headers: {
      accept: normalizedAccept,
      'user-agent': normalizedUserAgent
    }
  })

  const headers = PASS_HEADERS.reduce((acc, header) => {
    const value = upstream.headers.get(header)
    if (value) acc[header] = value
    return acc
  }, {})

  const buffer = Buffer.from(await upstream.arrayBuffer())

  return {
    status: upstream.status,
    headers,
    body: buffer
  }
}

function resolveAcceptHeader(path, acceptHeader) {
  const p = String(path || '').toLowerCase()
  if (p.endsWith('.glb') || p.endsWith('.gltf')) {
    return 'model/gltf-binary,model/gltf+json,application/octet-stream,*/*;q=0.8'
  }

  if (typeof acceptHeader === 'string' && acceptHeader.trim()) {
    return acceptHeader
  }

  return '*/*'
}
