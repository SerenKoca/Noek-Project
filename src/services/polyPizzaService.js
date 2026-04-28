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
  return `/api/poly-api${API_VERSION_PATH}`
})()

const STATIC_BASE_URL = (() => {
  if (import.meta.env.VITE_POLYPIZZA_STATIC_BASE_URL) return import.meta.env.VITE_POLYPIZZA_STATIC_BASE_URL
  if (import.meta.env.DEV) return '/poly-static'
  return '/api/poly-static'
})()

const RELATIVE_URL_BASE = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
const BASE_EXCLUDED_IDS = new Set()
const EXCLUDED_ID_PREFIXES = new Set()

const PREFERRED_TAGS = new Set(['tree', 'plant', 'chair', 'desk', 'bench', 'lamp', 'statue', 'boat', 'animal'])

const FALLBACK_CATEGORY = 'General'
const CONFIGURED_FURNITURE_LIST = String(import.meta.env.VITE_POLYPIZZA_FURNITURE_LIST || '').trim()
const CONFIGURED_FURNITURE_LISTS = String(import.meta.env.VITE_POLYPIZZA_FURNITURE_LISTS || '').trim()
const CONFIGURED_PINNED_MODELS = String(import.meta.env.VITE_POLYPIZZA_PINNED_MODELS || '').trim()
const CONFIGURED_EXCLUDE_IDS = String(import.meta.env.VITE_POLYPIZZA_EXCLUDE_IDS || '').trim()
const CONFIGURED_EXCLUDE_KEYWORDS = String(import.meta.env.VITE_POLYPIZZA_EXCLUDE_KEYWORDS || '').trim().toLowerCase()
const ONLY_CONFIGURED_SOURCES = String(import.meta.env.VITE_POLYPIZZA_ONLY_CONFIGURED || '').trim().toLowerCase() === 'true'

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000
})

attachGlobalLoaderToAxios(http)

function splitConfigList(value) {
  return String(value || '')
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function extractPolyErrorMessage(err, fallback = 'Unknown API error.') {
  const payload = err?.response?.data
  const messageCandidate =
    payload?.error?.message ||
    payload?.error ||
    payload?.message ||
    err?.message ||
    fallback

  if (typeof messageCandidate === 'string' && messageCandidate.trim()) {
    return messageCandidate.trim()
  }

  if (messageCandidate && typeof messageCandidate === 'object') {
    try {
      return JSON.stringify(messageCandidate)
    } catch {
      return fallback
    }
  }

  return fallback
}

function makeConfiguredExcludeIds() {
  const out = new Set(BASE_EXCLUDED_IDS)
  for (const id of splitConfigList(CONFIGURED_EXCLUDE_IDS)) {
    out.add(String(id))
  }
  return out
}

const EXCLUDED_IDS = makeConfiguredExcludeIds()
const EXCLUDED_KEYWORDS = new Set(splitConfigList(CONFIGURED_EXCLUDE_KEYWORDS).map((item) => item.toLowerCase()))

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

export function adaptStaticAssetUrl(url) {
  if (!url) return ''
  try {
    const parsed = new URL(url, RELATIVE_URL_BASE)
    const host = String(parsed.hostname || '').toLowerCase()
    const isLocalHost = host === 'localhost' || host === '127.0.0.1'

    if (isLocalHost && parsed.pathname.startsWith('/api/poly-static/')) {
      const suffix = `${parsed.pathname}${parsed.search || ''}${parsed.hash || ''}`
      return import.meta.env.DEV ? suffix.replace(/^\/api/, '') : suffix
    }

    if (isLocalHost && parsed.pathname.startsWith('/poly-static/')) {
      const suffix = `${parsed.pathname}${parsed.search || ''}${parsed.hash || ''}`
      return import.meta.env.DEV ? suffix : `/api${suffix}`
    }
  } catch {
    // Ignore URL parsing errors and continue with simple string checks.
  }

  if (url.startsWith(STATIC_BASE_URL)) return url
  if (url.startsWith('/poly-static/')) {
    return import.meta.env.DEV ? url : `/api${url}`
  }
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

function isAllowedCategory() {
  return true
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

  if (EXCLUDED_KEYWORDS.size) {
    const title = String(model?.Title || model?.raw?.Title || model?.title || '').toLowerCase()
    const category = String(model?.Category || model?.raw?.Category || '').toLowerCase()
    const tags = Array.isArray(model?.Tags)
      ? model.Tags.map((tag) => String(tag).toLowerCase()).join(' ')
      : ''
    const haystack = `${title} ${category} ${tags}`.trim()
    for (const keyword of EXCLUDED_KEYWORDS) {
      if (keyword && haystack.includes(keyword)) {
        return false
      }
    }
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

function extractListId(value) {
  const input = String(value || '').trim()
  if (!input) return ''

  if (/^[A-Za-z0-9_-]{6,}$/.test(input)) {
    return input
  }

  try {
    const parsed = new URL(input)
    const parts = parsed.pathname.split('/').filter(Boolean)
    const bundleIndex = parts.findIndex((part) => part.toLowerCase() === 'bundle')
    if (bundleIndex >= 0 && parts[bundleIndex + 1]) {
      const slug = String(parts[bundleIndex + 1]).trim()
      const token = slug.split('-').filter(Boolean).pop() || ''
      return token
    }

    const listIndex = parts.findIndex((part) => part.toLowerCase() === 'list' || part.toLowerCase() === 'l')
    if (listIndex >= 0 && parts[listIndex + 1]) {
      return String(parts[listIndex + 1]).trim()
    }
    const last = parts[parts.length - 1]
    return String(last || '').trim()
  } catch {
    return ''
  }
}

function extractModelId(value) {
  const input = String(value || '').trim()
  if (!input) return ''

  if (/^[A-Za-z0-9_-]{6,}$/.test(input)) {
    return input
  }

  try {
    const parsed = new URL(input)
    const parts = parsed.pathname.split('/').filter(Boolean)
    const modelIndex = parts.findIndex((part) => part.toLowerCase() === 'm' || part.toLowerCase() === 'model')
    if (modelIndex >= 0 && parts[modelIndex + 1]) {
      return String(parts[modelIndex + 1]).trim()
    }
    return String(parts[parts.length - 1] || '').trim()
  } catch {
    return ''
  }
}

function resolveConfiguredListInputs() {
  const values = []
  if (CONFIGURED_FURNITURE_LIST) values.push(CONFIGURED_FURNITURE_LIST)
  values.push(...splitConfigList(CONFIGURED_FURNITURE_LISTS))
  return [...new Set(values.map((value) => extractListId(value)).filter(Boolean))]
}

function resolveConfiguredPinnedModelIds() {
  return [...new Set(splitConfigList(CONFIGURED_PINNED_MODELS).map((value) => extractModelId(value)).filter(Boolean))]
}

async function fetchListModels(listId, headers) {
  const res = await http.get(`/list/${encodeURIComponent(listId)}`, { headers })
  const items = Array.isArray(res?.data?.Models) ? res.data.Models : []
  return items
    .map((model) => normalizeModel(model, 'api-list'))
    .filter((m) => isAllowedModel(m) && isCompatibleAssetUrl(m?.Download) && isAllowedCategory(m))
}

async function fetchModelById(modelId, headers) {
  const res = await http.get(`/model/${encodeURIComponent(modelId)}`, { headers })
  const normalized = normalizeModel(res?.data || {}, 'api-pinned')
  if (!isAllowedModel(normalized) || !isCompatibleAssetUrl(normalized?.Download) || !isAllowedCategory(normalized)) {
    return null
  }
  return normalized
}

async function fetchConfiguredFurnitureSources() {
  const headers = getAuthHeaders()
  const listIds = resolveConfiguredListInputs()
  const pinnedModelIds = resolveConfiguredPinnedModelIds()
  const errors = []

  if (!headers || (!listIds.length && !pinnedModelIds.length)) {
    return { ok: false, models: [], error: '' }
  }

  const collected = []

  for (const listId of listIds) {
    try {
      const models = await fetchListModels(listId, headers)
      collected.push(...models)
    } catch (err) {
      const status = err?.response?.status
      const msg = extractPolyErrorMessage(err, 'Kon Poly Pizza lijst niet laden.')
      const details = status === 404
        ? `${msg} (404: lijst-ID of endpoint niet gevonden)`
        : msg
      errors.push(`Lijst ${listId}: ${details}`)
    }
  }

  for (const modelId of pinnedModelIds) {
    try {
      const model = await fetchModelById(modelId, headers)
      if (model) collected.push(model)
    } catch (err) {
      const msg = extractPolyErrorMessage(err, 'Kon model niet laden.')
      errors.push(`Model ${modelId}: ${msg}`)
    }
  }

  return {
    ok: collected.length > 0,
    models: uniqueById(collected),
    error: errors.length ? `Poly Pizza configuratie fout: ${errors.join(' | ')}` : ''
  }
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
    const msg = extractPolyErrorMessage(err, 'Unknown API error.')
    const details = status === 404
      ? `${msg} (404: controleer /api/poly-api proxy route en endpoint pad)`
      : msg

    return {
      ok: false,
      error: `Poly Pizza API request failed: ${details}`,
      models: fallbackModels
        .map((model) => normalizeModel(model, 'fallback'))
        .filter((m) => isAllowedModel(m) && isAllowedCategory(m))
    }
  }
}

export async function fetchModels({ max = 200 } = {}) {
  const limit = Math.min(Math.max(1, max), 500)
  const sourceResult = await fetchConfiguredFurnitureSources()
  const pinnedFromConfig = Array.isArray(sourceResult.models) ? sourceResult.models : []
  const fallbackList = fallbackModels
    .map((model) => normalizeModel(model, 'fallback'))
    .filter((m) => isAllowedModel(m) && isCompatibleAssetUrl(m?.Download) && isAllowedCategory(m))

  if (ONLY_CONFIGURED_SOURCES) {
    if (pinnedFromConfig.length > 0) {
      return {
        models: pinnedFromConfig.slice(0, limit),
        error: sourceResult.error || ''
      }
    }

    return {
      models: fallbackList.slice(0, limit),
      error: sourceResult.error || 'Geen modellen gevonden in geconfigureerde lijsten/modellen. Toon fallbackmodellen.'
    }
  }

  // We want 6–12 models in the UI, but we must never exceed 12.
  // The API requires at least one filter on /search.
  // Strategy (spec-compliant, minimal requests):
  // - Try CC0 first (License=1), paging a couple of pages if needed.
  // - If we still have fewer than 6 compatible models, also try CC-BY (License=0).
  // - Always filter to models whose `Download` URL ends with .glb/.gltf.

  const MAX_PAGES_TO_TRY = 4 // 0..3

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
    const baseFallback = uniqueById([...pinnedFromConfig, ...fallbackList])
    const pinned = baseFallback.slice(0, limit)
    const rest = baseFallback.filter((m) => !pinned.some((p) => p.ID === m.ID))
    const diversifiedRest = diversifyModels(rest, Math.max(0, limit - pinned.length))
    return {
      models: [...pinned, ...diversifiedRest].slice(0, limit),
      error: [cc0.error, sourceResult.error].filter(Boolean).join(' | ')
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

  models = uniqueById([...pinnedFromConfig, ...models])
  const pinned = models.slice(0, limit)
  const rest = models.filter((m) => !pinned.some((p) => p.ID === m.ID))
  const diversifiedRest = diversifyModels(rest, Math.max(0, limit - pinned.length))
  models = [...pinned, ...diversifiedRest].slice(0, limit)

  if (models.length === 0) {
    // Empty or incompatible response: fallback.
    const baseFallback = uniqueById([...pinnedFromConfig, ...fallbackList])
    const pinnedFallback = baseFallback.slice(0, limit)
    const restFallback = baseFallback.filter((m) => !pinnedFallback.some((p) => p.ID === m.ID))
    const diversified = diversifyModels(restFallback, Math.max(0, limit - pinnedFallback.length))
    return {
      models: [...pinnedFallback, ...diversified].slice(0, limit),
      error: ['No compatible GLB/GLTF models returned by API.', sourceResult.error].filter(Boolean).join(' | ')
    }
  }

  return { models, error: sourceResult.error || '' }
}

export function isValidManualUrl(url) {
  return isCompatibleAssetUrl(url)
}
