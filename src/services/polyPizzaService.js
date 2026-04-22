import axios from 'axios'
import { fallbackModels } from './fallbackModels'
import { attachGlobalLoaderToAxios } from './globalLoading.js'

// Derived strictly from the provided OpenAPI YAML:
// - Server base URL: https://api.poly.pizza/v1.1 (proxy-able in dev)
// - Static assets served from https://static.poly.pizza (also proxied in dev)
// - Auth: apiKey in header, name: x-auth-token
// - Search endpoints:
//    GET /search (filters only; MUST provide at least one of License, Animated, or Category)
//    GET /search/{keyword}
// - Model fields include `ID`, `Title`, `Thumbnail`, `Download`, `Attribution` (see schemas/Model)

const API_ORIGIN = 'https://api.poly.pizza'
const API_VERSION_PATH = '/v1.1'
const STATIC_ORIGIN = 'https://static.poly.pizza'

const API_BASE_URL = (() => {
  if (import.meta.env.VITE_POLYPIZZA_API_BASE_URL) return import.meta.env.VITE_POLYPIZZA_API_BASE_URL
  if (import.meta.env.DEV) return `/poly-api${API_VERSION_PATH}`
  return `${API_ORIGIN}${API_VERSION_PATH}`
})()

const STATIC_BASE_URL = (() => {
  if (import.meta.env.VITE_POLYPIZZA_STATIC_BASE_URL) return import.meta.env.VITE_POLYPIZZA_STATIC_BASE_URL
  if (import.meta.env.DEV) return '/poly-static'
  return STATIC_ORIGIN
})()

const RELATIVE_URL_BASE = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
const EXCLUDED_CATEGORIES = new Set(['People & Characters'])
const EXCLUDED_IDS = new Set(['kZ3DmI'])
const EXCLUDED_ID_PREFIXES = new Set(['kZ3DmI'])

const PREFERRED_TAGS = new Set(['tree', 'plant', 'chair', 'desk', 'bench', 'lamp', 'statue', 'boat', 'animal'])

const FALLBACK_CATEGORY = 'General'

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000
})

attachGlobalLoaderToAxios(http)

function getAuthHeaders() {
  const apiKey = import.meta.env.VITE_POLYPIZZA_API_KEY

  // Fallback safely: if key is missing, we skip calling the API.
  if (!apiKey) {
    return null
  }

  return {
    // OpenAPI components.securitySchemes.apiKey
    'x-auth-token': apiKey
  }
}

function adaptStaticAssetUrl(url) {
  if (!url) return ''
  if (STATIC_BASE_URL === STATIC_ORIGIN) return url
  if (url.startsWith(STATIC_ORIGIN)) {
    return `${STATIC_BASE_URL}${url.slice(STATIC_ORIGIN.length)}`
  }
  return url
}

function isCompatibleAssetUrl(maybeUrl) {
  if (typeof maybeUrl !== 'string' || !maybeUrl.trim()) return false
  try {
    const u = new URL(maybeUrl, RELATIVE_URL_BASE)
    const path = (u.pathname || '').toLowerCase()
    return path.endsWith('.glb') || path.endsWith('.gltf')
  } catch {
    return false
  }
}

function normalizeModel(raw, source = 'api') {
  // Do not guess structure: these are the exact fields described in the OpenAPI schema `Model`.
  const id = raw?.ID
  const title = raw?.Title
  const download = adaptStaticAssetUrl(raw?.Download)
  const thumbnail = adaptStaticAssetUrl(raw?.Thumbnail)
  const tags = Array.isArray(raw?.Tags) ? raw.Tags : []

  return {
    // keep original keys too (useful for displaying without assumptions)
    raw,
    source,
    ID: id,
    Title: title,
    Download: download,
    Thumbnail: thumbnail,
    Attribution: raw?.Attribution,
    Licence: raw?.Licence,
    Category: raw?.Category,
    Tags: tags,
    // Standardized surface used by the UI + loaders
    id,
    title,
    name: title || 'Untitled model',
    url: download,
    downloadUrl: download,
    thumbnailUrl: thumbnail,
    previewUrl: thumbnail,
    preview: thumbnail,
    attribution: raw?.Attribution || '',
    licence: raw?.Licence || '',
    metadata: {
      category: raw?.Category || null,
      tags
    }
  }
}

function isAllowedCategory(model) {
  const category = model?.raw?.Category || model?.raw?.CategoryName || model?.Category
  if (!category) return true
  return !EXCLUDED_CATEGORIES.has(String(category).trim())
}

function isAllowedModel(model) {
  if (!model) return false
  const id = model.ID || model.raw?.ID
  if (!id) return false
  const normalized = String(id)
  if (EXCLUDED_IDS.has(normalized)) return false
  for (const prefix of EXCLUDED_ID_PREFIXES) {
    if (normalized.startsWith(prefix)) return false
  }
  return true
}

function hasPreferredTag(model) {
  if (!model || !Array.isArray(model.Tags)) return false
  return model.Tags.some((tag) => PREFERRED_TAGS.has(String(tag).toLowerCase()))
}

function categorizeModel(model) {
  const category = model?.Category || model?.raw?.Category
  return category ? String(category) : FALLBACK_CATEGORY
}

function diversifyModels(models, limit) {
  if (!Array.isArray(models) || !models.length) return []
  const buckets = new Map()
  for (const model of models) {
    const category = categorizeModel(model)
    if (!buckets.has(category)) buckets.set(category, [])
    buckets.get(category).push(model)
  }

  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => Number(hasPreferredTag(b)) - Number(hasPreferredTag(a)))
  }

  const categoryOrder = [...buckets.keys()].sort((a, b) => {
    const aPreferred = buckets.get(a).some(hasPreferredTag)
    const bPreferred = buckets.get(b).some(hasPreferredTag)
    if (aPreferred !== bPreferred) return Number(bPreferred) - Number(aPreferred)
    return a.localeCompare(b)
  })

  const selection = []
  let activeCategories = [...categoryOrder]

  while (selection.length < limit && activeCategories.length) {
    const nextRound = []
    for (const category of activeCategories) {
      const bucket = buckets.get(category)
      if (!bucket || bucket.length === 0) continue
      const next = bucket.shift()
      selection.push(next)
      if (bucket.length > 0) nextRound.push(category)
      if (selection.length === limit) break
    }
    activeCategories = nextRound
  }

  if (selection.length < limit) {
    for (const bucket of buckets.values()) {
      while (bucket.length && selection.length < limit) {
        selection.push(bucket.shift())
      }
      if (selection.length === limit) break
    }
  }

  return selection
}

function uniqueById(models) {
  const seen = new Set()
  const out = []
  for (const m of models) {
    const id = m?.ID
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(m)
  }
  return out
}

async function fetchSearchPage({ limit, page, license }) {
  const headers = getAuthHeaders()
  if (!headers) {
    // No key: return fallback.
    return {
      ok: false,
      error: 'Missing API key (VITE_POLYPIZZA_API_KEY).',
      models: fallbackModels.map((model) => normalizeModel(model, 'fallback')).filter((m) => isAllowedCategory(m))
    }
  }

  try {
    const res = await http.get('/search', {
      headers,
      // IMPORTANT: Parameter names are TitleCase in the spec.
      // The spec also says: "this endpoint needs at least one filter".
      params: {
        Limit: limit,
        Page: page,
        // Per spec: License 0 => CC-BY, 1 => CC0
        License: license
      }
    })

    // Spec response schema: components/schemas/Search
    // { total: number, results: Model[] }
    const results = res?.data?.results
    const arr = Array.isArray(results) ? results : []

    return { ok: true, models: arr.map((model) => normalizeModel(model, 'api')), error: '' }
  } catch (err) {
    const status = err?.response?.status

    if (status === 429) {
      return {
        ok: false,
        error: 'Rate limited by Poly Pizza API (HTTP 429).',
        models: fallbackModels
          .map((model) => normalizeModel(model, 'fallback'))
          .filter((m) => isAllowedModel(m) && isAllowedCategory(m))
      }
    }

    // OpenAPI includes 400 error shape; other errors are possible.
    const msg =
      err?.response?.data?.error?.message ||
      err?.response?.data?.error ||
      err?.message ||
      'Unknown API error.'

    return {
      ok: false,
      error: `Poly Pizza API request failed: ${msg}`,
      models: fallbackModels
        .map((model) => normalizeModel(model, 'fallback'))
        .filter((m) => isAllowedModel(m) && isAllowedCategory(m))
    }
  }
}

export async function fetchModels({ max = 12 } = {}) {
  const limit = Math.min(Math.max(1, max), 12)

  // We want 6–12 models in the UI, but we must never exceed 12.
  // The API requires at least one filter on /search.
  // Strategy (spec-compliant, minimal requests):
  // - Try CC0 first (License=1), paging a couple of pages if needed.
  // - If we still have fewer than 6 compatible models, also try CC-BY (License=0).
  // - Always filter to models whose `Download` URL ends with .glb/.gltf.

  const MAX_PAGES_TO_TRY = 3 // 0..2

  const gather = async (license) => {
    let out = []
    let lastError = ''

    for (let page = 0; page < MAX_PAGES_TO_TRY; page++) {
      const res = await fetchSearchPage({ limit, page, license })

      // If the API is failing/rate-limited, stop early and bubble up the error.
      if (!res.ok) {
        lastError = res.error || 'Failed to fetch models.'
        return { ok: false, models: out, error: lastError }
      }

      const compatible = res.models.filter(
        (m) => isAllowedModel(m) && isCompatibleAssetUrl(m?.Download) && isAllowedCategory(m)
      )
      out = uniqueById([...out, ...compatible])
      if (out.length >= 6) break
    }

    return { ok: true, models: out, error: '' }
  }

  const cc0 = await gather(1)
  if (!cc0.ok) {
    // API failure: fallback immediately (requirement).
    const fallbackList = fallbackModels
      .map((model) => normalizeModel(model, 'fallback'))
      .filter((m) => isAllowedModel(m) && isCompatibleAssetUrl(m?.Download) && isAllowedCategory(m))
    const diversified = diversifyModels(fallbackList, limit)
    return {
      models: diversified,
      error: cc0.error
    }
  }

  let models = cc0.models

  if (models.length < 6) {
    const ccby = await gather(0)
    if (!ccby.ok) {
      const diversified = diversifyModels(models, limit)
      // Partial success (CC0 worked) but CC-BY failed — keep what we have.
      return {
        models: diversified,
        error: ccby.error
      }
    }
    models = uniqueById([...models, ...ccby.models])
  }

  models = diversifyModels(models, limit)

  if (models.length === 0) {
    // Empty or incompatible response: fallback.
    const fallbackList = fallbackModels
      .map((model) => normalizeModel(model, 'fallback'))
      .filter((m) => isAllowedModel(m) && isCompatibleAssetUrl(m?.Download) && isAllowedCategory(m))
    const diversified = diversifyModels(fallbackList, limit)
    return {
      models: diversified,
      error: 'No compatible GLB/GLTF models returned by API.'
    }
  }

  return { models, error: '' }
}

export function isValidManualUrl(url) {
  return isCompatibleAssetUrl(url)
}
