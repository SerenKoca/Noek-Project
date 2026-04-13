import { proxyPolyApiRequest } from '../services/polyService.js'
import { ProxyError } from '../../lib/ProxyError.js'

export async function handlePolyProxy(req, res, context) {
  try {
    const result = await proxyPolyApiRequest({
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
    if (error instanceof ProxyError) {
      res.status(error.status)
      res.json(error.payload || { error: error.message })
      return
    }

    console.error('Poly Pizza proxy error', error)
    res.status(502).json({ error: 'Proxy request to Poly Pizza failed.' })
  }
}
