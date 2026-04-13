import axios from 'axios'

const BACKEND_BASE_URL = import.meta.env.VITE_NOEK_BACKEND_URL || '/api'

const http = axios.create({
  baseURL: BACKEND_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

export async function saveRoom(roomData) {
  const response = await http.post('/rooms', roomData)
  return response.data
}

export async function updateRoom(roomId, roomData) {
  const response = await http.put(`/rooms/${roomId}`, roomData)
  return response.data
}

export async function getRooms() {
  const response = await http.get('/rooms')
  return response.data
}
