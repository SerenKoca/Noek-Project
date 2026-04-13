import { ProxyError } from '../../lib/ProxyError.js'

const API_ORIGIN = 'https://api.poly.pizza'
const DEFAULT_HEADERS = ['cache-control', 'content-type', 'content-length']

export async function fetchPolyApiResource({ path, search, acceptHeader, userAgent }) {
  const token = process.env.POLYPIZZA_API_KEY || process.env.VITE_POLYPIZZA_API_KEY
  if (!token) {
    throw new ProxyError('Server missing Poly Pizza API key.', 500, { error: 'Server missing Poly Pizza API key.' })
  }

  const targetUrl = `${API_ORIGIN}${path}${search}`

  const upstream = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      'x-auth-token': token,
      accept: acceptHeader || 'application/json',
      'user-agent': userAgent || 'PolyPizzaProxy/1.0'
    }
  })

  const headers = DEFAULT_HEADERS.reduce((acc, header) => {
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
