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

    setProxyDebugHeaders(res, {
      proxy: 'poly-api',
      targetPath: context.targetPath,
      search: context.search,
      status: result.status
    })

    if (result.status >= 400) {
      console.warn('[poly-api-proxy] upstream non-2xx', {
        status: result.status,
        targetPath: context.targetPath,
        search: context.search,
        contentType: result.headers?.['content-type'] || '',
        bodyPreview: toBodyPreview(result.body)
      })
    }

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

function setProxyDebugHeaders(res, { proxy, targetPath, search, status }) {
  res.setHeader('x-noek-proxy', proxy)
  res.setHeader('x-noek-target-path', String(targetPath || '/'))
  res.setHeader('x-noek-target-search', String(search || ''))
  res.setHeader('x-noek-upstream-status', String(status || 0))
}

function toBodyPreview(buffer) {
  try {
    const text = Buffer.from(buffer || []).toString('utf8').trim()
    return text.slice(0, 280)
  } catch {
    return ''
  }
}
