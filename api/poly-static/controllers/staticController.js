import { proxyPolyStaticRequest } from '../services/staticService.js'

export async function handlePolyStatic(req, res, context) {
  try {
    const result = await proxyPolyStaticRequest({
      targetPath: context.targetPath,
      search: context.search,
      acceptHeader: req.headers.accept,
      userAgent: req.headers['user-agent']
    })

    res.status(result.status)
    Object.entries(result.headers).forEach(([key, value]) => {
      if (value) res.setHeader(key, value)
    })
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.send(result.body)
  } catch (error) {
    console.error('Poly Pizza static proxy error', error)
    res.status(502).json({ error: 'Proxy request to Poly Pizza static host failed.' })
  }
}
