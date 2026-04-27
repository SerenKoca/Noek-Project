const STATIC_ORIGIN = 'https://static.poly.pizza'
const PASS_HEADERS = ['cache-control', 'content-type', 'content-length']

export async function fetchPolyStaticAsset({ path, search, acceptHeader, userAgent }) {
  const url = `${STATIC_ORIGIN}${path}${search}`

  const upstream = await fetch(url, {
    method: 'GET',
    headers: {
      accept: acceptHeader || '*/*'
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
