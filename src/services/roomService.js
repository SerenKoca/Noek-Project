import axios from 'axios'
import { getAuthToken } from './authService.js'
import { attachGlobalLoaderToAxios } from './globalLoading.js'

const BACKEND_BASE_URL = import.meta.env.VITE_NOEK_BACKEND_URL || '/api'
let currentRoomEditKey = ''

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

  if (currentRoomEditKey) {
    config.headers['X-Room-Edit-Key'] = currentRoomEditKey
  }

  return config
})

export function setRoomEditKey(editKey) {
  currentRoomEditKey = String(editKey || '').trim()
}

export function clearRoomEditKey() {
  currentRoomEditKey = ''
}

export function getRoomEditKey() {
  return currentRoomEditKey
}

export async function saveRoom(roomData) {
  const response = await http.post('/rooms', roomData)
  return response.data
}

export async function updateRoom(roomId, roomData) {
  const response = await http.put(`/rooms/${roomId}`, roomData)
  return response.data
}

export async function getRoomById(roomId, options = {}) {
  const response = await http.get(`/rooms/${roomId}`, {
    loader: { skip: options.skipLoader === true }
  })
  return response.data
}

export async function createRoomEditLink(roomId) {
  const response = await http.post(`/rooms/${roomId}/edit-link`)
  return response.data
}

export async function deleteRoom(roomId) {
  const response = await http.delete(`/rooms/${roomId}`)
  return response.data
}

export async function getRooms(options = {}) {
  const response = await http.get('/rooms', {
    loader: { skip: options.skipLoader === true }
  })
  return response.data
}

export async function getRoomTemplate(options = {}) {
  const response = await http.get('/rooms/template', {
    params: options.templateKey ? { templateKey: options.templateKey } : undefined,
    loader: { skip: options.skipLoader === true }
  })
  return response.data
}

export async function getRoomContributions(roomId, options = {}) {
  const response = await http.get(`/rooms/${roomId}/contributions`, {
    loader: { skip: options.skipLoader === true }
  })
  return response.data
}

export async function createRoomContribution(roomId, payload) {
  const response = await http.post(`/rooms/${roomId}/contributions`, payload)
  return response.data
}

export async function reactToRoomContribution(roomId, contributionId, reactionType) {
  const response = await http.post(
    `/rooms/${roomId}/contributions/${contributionId}/reactions`,
    { reactionType }
  )
  return response.data
}

export async function addRoomContributionComment(roomId, contributionId, payload) {
  const response = await http.post(
    `/rooms/${roomId}/contributions/${contributionId}/comments`,
    payload
  )
  return response.data
}

export async function updateRoomMusic(roomId, payload) {
  const response = await http.patch(`/rooms/${roomId}/music`, payload)
  return response.data
}

export async function reactToRoom(roomId, reactionType) {
  const response = await http.post(`/rooms/${roomId}/room-reactions`, { reactionType })
  return response.data
}

export async function addRoomComment(roomId, payload) {
  const response = await http.post(`/rooms/${roomId}/room-comments`, payload)
  return response.data
}

export async function getMyContributions(options = {}) {
  const response = await http.get('/me/contributions', {
    loader: { skip: options.skipLoader === true }
  })
  return response.data
}
