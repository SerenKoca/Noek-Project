import axios from 'axios'

const AUTH_STORAGE_KEY = 'noek_auth'
const BACKEND_BASE_URL = import.meta.env.VITE_NOEK_BACKEND_URL || '/api'

const http = axios.create({
  baseURL: BACKEND_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

function safeParse(json) {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function getStoredAuth() {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) return null
  const parsed = safeParse(raw)
  if (!parsed?.token || !parsed?.user) return null
  return parsed
}

export function getAuthToken() {
  return getStoredAuth()?.token || ''
}

export function storeAuth(payload) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
}

export function clearAuth() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}

export async function registerAccount({ email, password, displayName, registrationCode, registerRole }) {
  const response = await http.post('/auth', {
    action: 'register',
    email,
    password,
    displayName,
    registrationCode,
    registerRole
  })
  storeAuth(response.data)
  return response.data
}

export async function loginAccount({ email, password }) {
  const response = await http.post('/auth', {
    action: 'login',
    email,
    password
  })
  storeAuth(response.data)
  return response.data
}
