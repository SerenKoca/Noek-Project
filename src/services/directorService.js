import axios from 'axios'
import { getAuthToken } from './authService.js'
import { attachGlobalLoaderToAxios } from './globalLoading.js'

const BACKEND_BASE_URL = import.meta.env.VITE_NOEK_BACKEND_URL || '/api'

const http = axios.create({
  baseURL: BACKEND_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

attachGlobalLoaderToAxios(http)

http.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export async function getMyEditors() {
  const response = await http.get('/director/editors')
  return response.data
}

export async function getMyEditorCodes() {
  const response = await http.get('/director/editor-codes')
  return response.data
}

export async function generateEditorCode(payload = {}) {
  const response = await http.post('/director/editor-codes', payload)
  return response.data
}

export async function getMyBranding() {
  const response = await http.get('/director/branding')
  return response.data
}

export async function updateMyBranding(payload) {
  const response = await http.put('/director/branding', payload)
  return response.data
}
