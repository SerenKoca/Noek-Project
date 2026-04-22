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

export async function getFuneralDirectors() {
  const response = await http.get('/admin/funeral-directors')
  return response.data
}

export async function createFuneralDirector(payload) {
  const response = await http.post('/admin/funeral-directors', payload)
  return response.data
}

export async function deleteFuneralDirector(id) {
  const response = await http.delete(`/admin/funeral-directors/${id}`)
  return response.data
}
