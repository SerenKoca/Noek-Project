import { proxyPolyStaticRequest } from '../services/staticService.js'

export async function handlePolyStatic(req, res, context) {
  try {
    const result = await proxyPolyStaticRequest({
      targetPath: context.targetPath,
      search: context.search,
      headers: pickForwardHeaders(req.headers)
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

function pickForwardHeaders(headers = {}) {
  return {
    accept: headers.accept,
    'accept-language': headers['accept-language'],
    origin: headers.origin,
    referer: headers.referer || headers.referrer,
    'sec-ch-ua': headers['sec-ch-ua'],
    'sec-ch-ua-mobile': headers['sec-ch-ua-mobile'],
    'sec-ch-ua-platform': headers['sec-ch-ua-platform'],
    'sec-fetch-dest': headers['sec-fetch-dest'],
    'sec-fetch-mode': headers['sec-fetch-mode'],
    'sec-fetch-site': headers['sec-fetch-site'],
    'user-agent': headers['user-agent']
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
