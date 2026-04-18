import axios from 'axios'
import { getAuthToken } from './authService.js'

const BACKEND_BASE_URL = import.meta.env.VITE_NOEK_BACKEND_URL || '/api'
const VISITOR_KEY_STORAGE = 'noek_visitor_key'

const http = axios.create({
  baseURL: BACKEND_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

const localApi = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

function createVisitorKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function getVisitorKey() {
  if (typeof window === 'undefined') return 'visitor-server'

  const existing = window.localStorage.getItem(VISITOR_KEY_STORAGE)
  if (existing) return existing

  const next = createVisitorKey()
  window.localStorage.setItem(VISITOR_KEY_STORAGE, next)
  return next
}

http.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

localApi.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

async function requestWithApiFallback(makePrimaryRequest, makeFallbackRequest) {
  try {
    const response = await makePrimaryRequest()
    return response.data
  } catch (error) {
    const usesLocalApi = BACKEND_BASE_URL === '/api'
    if (usesLocalApi) throw error

    const status = error?.response?.status
    if (![404, 405, 501].includes(status)) {
      throw error
    }

    const fallbackResponse = await makeFallbackRequest()
    return fallbackResponse.data
  }
}

export async function getPublicRoom(roomId) {
  return requestWithApiFallback(
    () => http.get(`/public/rooms/${roomId}`),
    () => localApi.get(`/public/rooms/${roomId}`)
  )
}

export async function getPublicRoomContributions(roomId) {
  return requestWithApiFallback(
    () => http.get(`/public/rooms/${roomId}/contributions`),
    () => localApi.get(`/public/rooms/${roomId}/contributions`)
  )
}

export async function createPublicRoomContribution(roomId, payload) {
  return requestWithApiFallback(
    () => http.post(`/public/rooms/${roomId}/contributions`, payload),
    () => localApi.post(`/public/rooms/${roomId}/contributions`, payload)
  )
}

export async function reactToPublicRoomContribution(roomId, contributionId, reactionType) {
  const payload = {
    reactionType,
    visitorKey: getVisitorKey()
  }

  return requestWithApiFallback(
    () => http.post(`/public/rooms/${roomId}/contributions/${contributionId}/reactions`, payload),
    () => localApi.post(`/public/rooms/${roomId}/contributions/${contributionId}/reactions`, payload)
  )
}

export async function addPublicRoomContributionComment(roomId, contributionId, payload) {
  return requestWithApiFallback(
    () => http.post(`/public/rooms/${roomId}/contributions/${contributionId}/comments`, payload),
    () => localApi.post(`/public/rooms/${roomId}/contributions/${contributionId}/comments`, payload)
  )
}

export async function reactToPublicRoom(roomId, reactionType) {
  const payload = {
    reactionType,
    visitorKey: getVisitorKey()
  }

  return requestWithApiFallback(
    () => http.post(`/public/rooms/${roomId}/room-reactions`, payload),
    () => localApi.post(`/public/rooms/${roomId}/room-reactions`, payload)
  )
}

export async function addPublicRoomComment(roomId, payload) {
  return requestWithApiFallback(
    () => http.post(`/public/rooms/${roomId}/room-comments`, payload),
    () => localApi.post(`/public/rooms/${roomId}/room-comments`, payload)
  )
}
