import { computed, reactive, readonly, ref } from 'vue'

const state = reactive({
  activeCount: 0
})

const activeTokens = new Set()
const loaderVisible = ref(false)
const SHOW_DELAY_MS = 140
const MIN_VISIBLE_MS = 650

let showTimerId = null
let hideTimerId = null
let visibleSince = 0

function clearShowTimer() {
  if (!showTimerId) return
  window.clearTimeout(showTimerId)
  showTimerId = null
}

function clearHideTimer() {
  if (!hideTimerId) return
  window.clearTimeout(hideTimerId)
  hideTimerId = null
}

function syncLoaderVisibility() {
  if (state.activeCount > 0) {
    clearHideTimer()
    if (loaderVisible.value || showTimerId) return

    showTimerId = window.setTimeout(() => {
      showTimerId = null
      if (state.activeCount > 0 && !loaderVisible.value) {
        loaderVisible.value = true
        visibleSince = Date.now()
      }
    }, SHOW_DELAY_MS)
    return
  }

  clearShowTimer()
  if (!loaderVisible.value) return

  const elapsed = Date.now() - visibleSince
  const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed)

  clearHideTimer()
  hideTimerId = window.setTimeout(() => {
    hideTimerId = null
    if (state.activeCount === 0) {
      loaderVisible.value = false
      visibleSince = 0
    }
  }, remaining)
}

function normalizeMethod(method) {
  return String(method || 'get').trim().toLowerCase()
}

function shouldTrackRequest(config = {}) {
  const loaderCfg = config.loader || {}

  if (loaderCfg.skip === true) return false
  if (loaderCfg.track === true) return true

  const method = normalizeMethod(config.method)
  return method === 'get'
}

export function startGlobalLoading() {
  const token = Symbol('global-loader-token')
  activeTokens.add(token)
  state.activeCount += 1
  syncLoaderVisibility()
  return token
}

export function endGlobalLoading(token) {
  if (!token || !activeTokens.has(token)) return
  activeTokens.delete(token)
  state.activeCount = Math.max(0, state.activeCount - 1)
  syncLoaderVisibility()
}

export function trackPromiseWithGlobalLoader(promise) {
  const token = startGlobalLoading()
  return Promise.resolve(promise).finally(() => endGlobalLoading(token))
}

export function attachGlobalLoaderToAxios(http) {
  if (!http?.interceptors) return

  http.interceptors.request.use((config) => {
    if (shouldTrackRequest(config)) {
      config.__globalLoadingToken = startGlobalLoading()
    }
    return config
  })

  http.interceptors.response.use(
    (response) => {
      endGlobalLoading(response?.config?.__globalLoadingToken)
      return response
    },
    (error) => {
      endGlobalLoading(error?.config?.__globalLoadingToken)
      return Promise.reject(error)
    }
  )
}

const isGlobalLoading = computed(() => loaderVisible.value)

export function useGlobalLoadingState() {
  return {
    state: readonly(state),
    isGlobalLoading
  }
}
