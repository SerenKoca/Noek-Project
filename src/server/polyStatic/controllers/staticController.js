import { proxyPolyStaticRequest } from '../services/staticService.js'

export async function handlePolyStatic(req, res, context) {
  try {
    const result = await proxyPolyStaticRequest({
      targetPath: context.targetPath,
      search: context.search,
      acceptHeader: req.headers.accept,
      userAgent: req.headers['user-agent']
    })

    setProxyDebugHeaders(res, {
      proxy: 'poly-static',
      targetPath: context.targetPath,
      search: context.search,
      status: result.status
    })

    if (result.status >= 400) {
      console.warn('[poly-static-proxy] upstream non-2xx', {
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
    console.error('Poly Pizza static proxy error', error)
    res.status(502).json({ error: 'Proxy request to Poly Pizza static host failed.' })
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
