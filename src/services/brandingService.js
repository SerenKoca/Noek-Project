import axios from 'axios'
import { getAuthToken } from './authService.js'

const BACKEND_BASE_URL = import.meta.env.VITE_NOEK_BACKEND_URL || '/api'

const http = axios.create({
  baseURL: BACKEND_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

http.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export async function getMyBranding() {
  const response = await http.get('/me/branding')
  return response.data
}

export async function getDirectorBranding() {
  const response = await http.get('/director/branding')
  return response.data
}

export async function updateDirectorBranding(payload) {
  const response = await http.put('/director/branding', payload)
  return response.data
}
