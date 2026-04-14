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

export async function saveRoom(roomData) {
  const response = await http.post('/rooms', roomData)
  return response.data
}

export async function updateRoom(roomId, roomData) {
  const response = await http.put(`/rooms/${roomId}`, roomData)
  return response.data
}

export async function deleteRoom(roomId) {
  const response = await http.delete(`/rooms/${roomId}`)
  return response.data
}

export async function getRooms() {
  const response = await http.get('/rooms')
  return response.data
}

export async function getRoomContributions(roomId) {
  const response = await http.get(`/rooms/${roomId}/contributions`)
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
