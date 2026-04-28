const STATIC_ORIGIN = 'https://static.poly.pizza'
const PASS_HEADERS = ['cache-control', 'content-type', 'content-length']

export async function fetchPolyStaticAsset({ path, search, headers = {} }) {
  const url = `${STATIC_ORIGIN}${path}${search}`
  const normalizedAccept = resolveAcceptHeader(path, headers.accept)
  const normalizedUserAgent = resolveUserAgent(headers['user-agent'])

  const upstream = await fetch(url, {
    method: 'GET',
    headers: {
      accept: normalizedAccept,
      'accept-language': headers['accept-language'],
      origin: headers.origin,
      referer: headers.referer || headers.referrer,
      'sec-ch-ua': headers['sec-ch-ua'],
      'sec-ch-ua-mobile': headers['sec-ch-ua-mobile'],
      'sec-ch-ua-platform': headers['sec-ch-ua-platform'],
      'sec-fetch-dest': headers['sec-fetch-dest'],
      'sec-fetch-mode': headers['sec-fetch-mode'],
      'sec-fetch-site': headers['sec-fetch-site'],
      'user-agent': normalizedUserAgent
    }
  })

  const responseHeaders = PASS_HEADERS.reduce((acc, header) => {
    const value = upstream.headers.get(header)
    if (value) acc[header] = value
    return acc
  }, {})

  const buffer = Buffer.from(await upstream.arrayBuffer())

  return {
    status: upstream.status,
    headers: responseHeaders,
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

function resolveUserAgent(userAgent) {
  if (typeof userAgent === 'string' && userAgent.trim()) {
    return userAgent
  }

  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
}
