<script setup>
import { ref, onMounted, computed } from 'vue'
import Sidebar from './components/Sidebar.vue'
import ThreeScene from './components/ThreeScene.vue'
import EditorTopLeftControls from './components/EditorTopLeftControls.vue'
import EditorRoomName from './components/EditorRoomName.vue'
import EditorBrand from './components/EditorBrand.vue'
import EditorHistoryControls from './components/EditorHistoryControls.vue'
import SceneOverlays from './components/SceneOverlays.vue'
import {
  saveRoom,
  updateRoom,
  getRooms,
  getRoomContributions,
  createRoomContribution,
  reactToRoomContribution,
  addRoomContributionComment
} from './services/roomService.js'
import { loginAccount, registerAccount, getStoredAuth, clearAuth } from './services/authService.js'

const view = ref('home')
const rooms = ref([])
const authState = ref(getStoredAuth())
const authEmail = ref('')
const authPassword = ref('')
const authDisplayName = ref('')
const authMode = ref('login')
const authStatus = ref('')
const authStatusType = ref('')
const loadRequest = ref(null)
const selected = ref(null)
const selectedAnchor = ref(null)
const lastLoadError = ref('')
const sceneCommand = ref(null)
const sceneRef = ref(null)
const roomName = ref('Naam kamer')
const saveStatus = ref('')
const saveStatusType = ref('') // 'success', 'error', 'loading', or ''
const currentRoomData = ref(null) // For loading room data into scene
const currentRoom = ref(null) // The current room being edited (for updates)
const activeContributionsRoomId = ref('')
const roomContributions = ref({})
const contributionLoadState = ref({ loadingRoomId: '', error: '' })
const newCandleForm = ref({ tributeText: '' })
const newMusicUrlForm = ref({ externalUrl: '', tributeText: '' })
const newVideoUrlForm = ref({ externalUrl: '', tributeText: '' })
const newPhotoFile = ref(null)
const newVideoFile = ref(null)
const newPhotoFileForm = ref({ tributeText: '' })
const newVideoFileForm = ref({ tributeText: '' })
const photoInputKey = ref(0)
const videoInputKey = ref(0)
const contributionCreateState = ref({ loading: false, error: '', success: '' })
const photoUploadState = ref({ loading: false, error: '', success: '' })
const videoFileUploadState = ref({ loading: false, error: '', success: '' })
const commentDrafts = ref({})
const commentStateByItem = ref({})
const currentUserId = computed(() => authState.value?.user?.id || '')
const autoGiverName = computed(() => {
  const displayName = authState.value?.user?.displayName?.trim()
  return displayName || authState.value?.user?.email || ''
})
const detectedMusicPlatform = computed(() => detectMusicPlatform(newMusicUrlForm.value.externalUrl))
const musicYoutubeVideoId = computed(() => {
  if (detectedMusicPlatform.value !== 'youtube') return ''
  return extractYouTubeVideoId(newMusicUrlForm.value.externalUrl)
})
const videoYoutubeVideoId = computed(() => extractYouTubeVideoId(newVideoUrlForm.value.externalUrl))
const musicYoutubeEmbedUrl = computed(() => {
  return musicYoutubeVideoId.value ? `https://www.youtube.com/embed/${musicYoutubeVideoId.value}` : ''
})
const musicSpotifyEmbedUrl = computed(() => {
  return buildSpotifyEmbedUrl(newMusicUrlForm.value.externalUrl)
})
const videoYoutubeEmbedUrl = computed(() => {
  return videoYoutubeVideoId.value ? `https://www.youtube.com/embed/${videoYoutubeVideoId.value}` : ''
})

function resetContributionDrafts() {
  newCandleForm.value = { tributeText: '' }
  newMusicUrlForm.value = { externalUrl: '', tributeText: '' }
  newVideoUrlForm.value = { externalUrl: '', tributeText: '' }
  newPhotoFile.value = null
  newVideoFile.value = null
  newPhotoFileForm.value = { tributeText: '' }
  newVideoFileForm.value = { tributeText: '' }
  photoInputKey.value += 1
  videoInputKey.value += 1
  photoUploadState.value = { loading: false, error: '', success: '' }
  videoFileUploadState.value = { loading: false, error: '', success: '' }
}

function countWords(value) {
  return (value || '').trim().split(/\s+/).filter(Boolean).length
}

function extractYouTubeVideoId(rawUrl) {
  const input = (rawUrl || '').trim()
  if (!input) return ''

  try {
    const url = new URL(input)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0] || ''
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : ''
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const fromQuery = url.searchParams.get('v') || ''
      if (/^[A-Za-z0-9_-]{11}$/.test(fromQuery)) return fromQuery

      const parts = url.pathname.split('/').filter(Boolean)
      const embedIndex = parts.findIndex((part) => part === 'embed' || part === 'shorts')
      if (embedIndex >= 0 && parts[embedIndex + 1]) {
        const id = parts[embedIndex + 1]
        return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : ''
      }
    }
  } catch {
    return ''
  }

  return ''
}

function detectMusicPlatform(rawUrl) {
  const input = (rawUrl || '').trim()
  if (!input) return 'none'

  try {
    const url = new URL(input)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()

    if (host === 'spotify.com' || host.endsWith('.spotify.com') || host === 'open.spotify.com') {
      return 'spotify'
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
      return 'youtube'
    }
  } catch {
    return 'none'
  }

  return 'none'
}

function buildSpotifyEmbedUrl(rawUrl) {
  const input = (rawUrl || '').trim()
  if (!input) return ''

  try {
    const url = new URL(input)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    if (host !== 'open.spotify.com') return ''

    const parts = url.pathname.split('/').filter(Boolean)
    if (parts[0] === 'intl' && parts.length >= 4) {
      const type = parts[2]
      const id = parts[3]
      if (isSpotifyType(type) && isSpotifyId(id)) {
        return `https://open.spotify.com/embed/${type}/${id}`
      }
      return ''
    }

    if (parts.length >= 2) {
      const type = parts[0]
      const id = parts[1]
      if (isSpotifyType(type) && isSpotifyId(id)) {
        return `https://open.spotify.com/embed/${type}/${id}`
      }
    }
  } catch {
    return ''
  }

  return ''
}

function isSpotifyType(type) {
  return ['track', 'album', 'playlist', 'artist', 'episode', 'show'].includes((type || '').toLowerCase())
}

function isSpotifyId(id) {
  return /^[A-Za-z0-9]+$/.test(id || '')
}

function handlePhotoFileChange(event) {
  newPhotoFile.value = event.target.files?.[0] || null
}

function handleVideoFileChange(event) {
  newVideoFile.value = event.target.files?.[0] || null
}

async function uploadToCloudinary(file, resourceType) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || ''
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || ''

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary configuratie ontbreekt.')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    {
      method: 'POST',
      body: formData
    }
  )

  if (!response.ok) {
    throw new Error('Upload naar Cloudinary mislukt.')
  }

  return response.json()
}

async function loadRooms() {
  if (!authState.value?.token) {
    rooms.value = []
    return
  }

  try {
    rooms.value = await getRooms()
  } catch (error) {
    console.error('Failed to load rooms', error)
    rooms.value = []
  }
}

async function toggleRoomContributions(room) {
  if (!room?._id) return

  if (activeContributionsRoomId.value === room._id) {
    activeContributionsRoomId.value = ''
    contributionLoadState.value = { loadingRoomId: '', error: '' }
    resetContributionDrafts()
    contributionCreateState.value = { loading: false, error: '', success: '' }
    return
  }

  activeContributionsRoomId.value = room._id
  contributionLoadState.value = { loadingRoomId: room._id, error: '' }
  contributionCreateState.value = { loading: false, error: '', success: '' }
  resetContributionDrafts()

  try {
    const items = await getRoomContributions(room._id)
    roomContributions.value = {
      ...roomContributions.value,
      [room._id]: Array.isArray(items) ? items : []
    }
    contributionLoadState.value = { loadingRoomId: '', error: '' }
  } catch (error) {
    console.error('Failed to load room contributions', error)
    roomContributions.value = {
      ...roomContributions.value,
      [room._id]: []
    }
    contributionLoadState.value = {
      loadingRoomId: '',
      error: error?.response?.data?.error || 'Kon bijdragen niet laden.'
    }
  }
}

async function addCandleContribution(room) {
  const tributeText = (newCandleForm.value.tributeText || '').trim()
  return addContribution(room, {
    type: 'candle',
    tributeText,
    externalUrl: '',
    platform: 'none',
    successMessage: 'Kaarsje toegevoegd.'
  })
}

async function addMusicUrlContribution(room) {
  const tributeText = (newMusicUrlForm.value.tributeText || '').trim()
  const externalUrl = (newMusicUrlForm.value.externalUrl || '').trim()
  const platform = detectedMusicPlatform.value

  return addContribution(room, {
    type: 'music_url',
    tributeText,
    externalUrl,
    platform,
    successMessage: 'Muzieklink toegevoegd.'
  })
}

async function addVideoUrlContribution(room) {
  const tributeText = (newVideoUrlForm.value.tributeText || '').trim()
  const externalUrl = (newVideoUrlForm.value.externalUrl || '').trim()

  return addContribution(room, {
    type: 'video_url',
    tributeText,
    externalUrl,
    platform: 'youtube',
    successMessage: 'Videolink toegevoegd.'
  })
}

async function addPhotoFileContribution(room) {
  const file = newPhotoFile.value
  const tributeText = (newPhotoFileForm.value.tributeText || '').trim()

  if (!file) {
    photoUploadState.value = { loading: false, error: 'Kies eerst een fotobestand.', success: '' }
    return
  }

  if (!file.type?.startsWith('image/')) {
    photoUploadState.value = { loading: false, error: 'Kies een geldig afbeeldingsbestand.', success: '' }
    return
  }

  if (countWords(tributeText) > 150) {
    photoUploadState.value = { loading: false, error: 'Tekst mag maximaal 150 woorden bevatten.', success: '' }
    return
  }

  photoUploadState.value = { loading: true, error: '', success: '' }

  try {
    const uploadResult = await uploadToCloudinary(file, 'image')
    await addContribution(room, {
      type: 'photo',
      tributeText,
      externalUrl: '',
      mediaUrl: uploadResult.secure_url || '',
      platform: 'none',
      successMessage: 'Foto toegevoegd.'
    })

    newPhotoFile.value = null
    newPhotoFileForm.value = { tributeText: '' }
    photoUploadState.value = { loading: false, error: '', success: 'Foto geüpload.' }
  } catch (error) {
    photoUploadState.value = {
      loading: false,
      error: error?.response?.data?.error || error?.message || 'Foto uploaden mislukt.',
      success: ''
    }
  }
}

async function addVideoFileContribution(room) {
  const file = newVideoFile.value
  const tributeText = (newVideoFileForm.value.tributeText || '').trim()

  if (!file) {
    videoFileUploadState.value = { loading: false, error: 'Kies eerst een videobestand.', success: '' }
    return
  }

  if (!file.type?.startsWith('video/')) {
    videoFileUploadState.value = { loading: false, error: 'Kies een geldig videobestand.', success: '' }
    return
  }

  if (countWords(tributeText) > 150) {
    videoFileUploadState.value = { loading: false, error: 'Tekst mag maximaal 150 woorden bevatten.', success: '' }
    return
  }

  videoFileUploadState.value = { loading: true, error: '', success: '' }

  try {
    const uploadResult = await uploadToCloudinary(file, 'video')
    await addContribution(room, {
      type: 'video_file',
      tributeText,
      externalUrl: '',
      mediaUrl: uploadResult.secure_url || '',
      platform: 'none',
      successMessage: 'Videobestand toegevoegd.'
    })

    newVideoFile.value = null
    newVideoFileForm.value = { tributeText: '' }
    videoFileUploadState.value = { loading: false, error: '', success: 'Video geüpload.' }
  } catch (error) {
    videoFileUploadState.value = {
      loading: false,
      error: error?.response?.data?.error || error?.message || 'Video uploaden mislukt.',
      success: ''
    }
  }
}

async function addContribution(room, payload) {
  const roomId = room?._id
  if (!roomId) return

  const giverName = autoGiverName.value.trim()
  const tributeText = (payload.tributeText || '').trim()
  const words = countWords(tributeText)

  contributionCreateState.value = { loading: false, error: '', success: '' }

  if (!giverName) {
    contributionCreateState.value.error = 'Geen gevernaam gevonden in je account.'
    return
  }

  if (words > 150) {
    contributionCreateState.value.error = 'Tekst mag maximaal 150 woorden bevatten.'
    return
  }

  if ((payload.type === 'music_url' || payload.type === 'video_url') && !payload.externalUrl) {
    contributionCreateState.value.error = 'URL is verplicht voor muziek en video links.'
    return
  }

  if ((payload.type === 'photo' || payload.type === 'video_file') && !payload.mediaUrl) {
    contributionCreateState.value.error = 'Upload eerst een bestand voor foto en video uploads.'
    return
  }

  if (payload.type === 'music_url' && payload.platform !== 'youtube' && payload.platform !== 'spotify') {
    contributionCreateState.value.error = 'Gebruik een geldige YouTube of Spotify link voor muziek.'
    return
  }

  contributionCreateState.value.loading = true

  try {
    await createRoomContribution(roomId, {
      type: payload.type,
      giverName,
      tributeText,
      mediaUrl: payload.mediaUrl || '',
      externalUrl: payload.externalUrl || '',
      platform: payload.platform || 'none'
    })

    const items = await getRoomContributions(roomId)
    roomContributions.value = {
      ...roomContributions.value,
      [roomId]: Array.isArray(items) ? items : []
    }

    resetContributionDrafts()
    contributionCreateState.value = {
      loading: false,
      error: '',
      success: payload.successMessage || 'Bijdrage toegevoegd.'
    }
  } catch (error) {
    contributionCreateState.value = {
      loading: false,
      error: error?.response?.data?.error || 'Kon bijdrage niet opslaan.',
      success: ''
    }
  }
}

function mergeContributionItem(roomId, updatedItem) {
  if (!roomId || !updatedItem?._id) return

  const items = roomContributions.value[roomId] || []
  const updated = items.map((item) => (item._id === updatedItem._id ? updatedItem : item))
  roomContributions.value = {
    ...roomContributions.value,
    [roomId]: updated
  }
}

async function reactOnContribution(roomId, contributionId, reactionType) {
  try {
    const updatedItem = await reactToRoomContribution(roomId, contributionId, reactionType)
    mergeContributionItem(roomId, updatedItem)
  } catch (error) {
    console.error('Failed to react on contribution', error)
  }
}

function getUserReaction(item) {
  const userId = currentUserId.value
  if (!userId) return ''

  const entry = (item?.reactedUsers || []).find((row) => row?.userId === userId)
  return entry?.reactionType || ''
}

async function submitContributionComment(roomId, contributionId) {
  const text = (commentDrafts.value[contributionId] || '').trim()
  if (!text) return

  commentStateByItem.value = {
    ...commentStateByItem.value,
    [contributionId]: { loading: true, error: '' }
  }

  try {
    const updatedItem = await addRoomContributionComment(roomId, contributionId, {
      text,
      displayName: autoGiverName.value || 'Gebruiker'
    })

    mergeContributionItem(roomId, updatedItem)
    commentDrafts.value = {
      ...commentDrafts.value,
      [contributionId]: ''
    }
    commentStateByItem.value = {
      ...commentStateByItem.value,
      [contributionId]: { loading: false, error: '' }
    }
  } catch (error) {
    commentStateByItem.value = {
      ...commentStateByItem.value,
      [contributionId]: {
        loading: false,
        error: error?.response?.data?.error || 'Commentaar opslaan mislukt.'
      }
    }
  }
}

async function openEditor(room = null) {
  console.log('Opening editor for room:', room?.name, room?.sceneData)
  selected.value = null
  selectedAnchor.value = null
  lastLoadError.value = ''
  roomName.value = room?.name || 'Naam kamer'
  view.value = 'editor'
  saveStatus.value = ''
  saveStatusType.value = ''

  // Set current room for updates
  currentRoom.value = room

  console.log('About to set currentRoomData, current value:', currentRoomData.value)
  // Set room data to be loaded when scene is ready
  const roomData = room?.sceneData ? JSON.parse(JSON.stringify(room.sceneData)) : null
  currentRoomData.value = roomData
  console.log('Set currentRoomData.value to:', currentRoomData.value)
}

function showHome() {
  console.log('Going back to home, resetting currentRoomData')
  view.value = 'home'
  saveStatus.value = ''
  saveStatusType.value = ''
  currentRoomData.value = null
  currentRoom.value = null
  activeContributionsRoomId.value = ''
  resetContributionDrafts()
  contributionCreateState.value = { loading: false, error: '', success: '' }
}

onMounted(() => {
  if (authState.value?.token) {
    loadRooms()
  }
})

async function onAuthSubmit() {
  authStatus.value = ''
  authStatusType.value = ''

  const email = authEmail.value.trim()
  const password = authPassword.value
  const displayName = authDisplayName.value.trim()

  if (!email || !password) {
    authStatus.value = 'Email en wachtwoord zijn verplicht.'
    authStatusType.value = 'error'
    return
  }

  if (authMode.value === 'register' && password.length < 8) {
    authStatus.value = 'Wachtwoord moet minstens 8 tekens hebben.'
    authStatusType.value = 'error'
    return
  }

  authStatus.value = authMode.value === 'register' ? 'Account aanmaken...' : 'Inloggen...'
  authStatusType.value = 'loading'

  try {
    const result = authMode.value === 'register'
      ? await registerAccount({ email, password, displayName })
      : await loginAccount({ email, password })

    authState.value = result
    authPassword.value = ''
    authStatus.value = `Welkom ${result?.user?.displayName || result?.user?.email || ''}`
    authStatusType.value = 'success'
    await loadRooms()
  } catch (error) {
    authStatus.value = error?.response?.data?.error || 'Authenticatie mislukt.'
    authStatusType.value = 'error'
  }
}

function onLogout() {
  clearAuth()
  authState.value = null
  rooms.value = []
  roomContributions.value = {}
  activeContributionsRoomId.value = ''
  contributionLoadState.value = { loadingRoomId: '', error: '' }
  resetContributionDrafts()
  contributionCreateState.value = { loading: false, error: '', success: '' }
  currentRoom.value = null
  currentRoomData.value = null
  view.value = 'home'
  authStatus.value = 'Je bent uitgelogd.'
  authStatusType.value = 'success'
}

function onLoadModel(modelLike) {
  // Ensure watch triggers even if the same item is loaded twice.
  loadRequest.value = { ...modelLike, _requestId: Date.now() }
}

function onDeleteSelected() {
  sceneCommand.value = { type: 'delete-selected', _requestId: Date.now() }
}

function onSelected(info) {
  selected.value = info
}

function onSelectedAnchor(anchor) {
  selectedAnchor.value = anchor
}

function onLoadError(message) {
  lastLoadError.value = message || 'Failed to load model.'
  window.setTimeout(() => {
    if (lastLoadError.value === message) lastLoadError.value = ''
  }, 6000)
}

async function onSave() {
  if (!sceneRef.value?.serializeRoom) {
    saveStatus.value = 'Scene is niet klaar om op te slaan.'
    saveStatusType.value = 'error'
    return
  }

  const sceneData = sceneRef.value.serializeRoom()
  const name = roomName.value?.trim() || window.prompt('Geef je kamer een naam', 'Mijn kamer')

  if (!name) {
    saveStatus.value = 'Kamernaam is verplicht.'
    saveStatusType.value = 'error'
    return
  }

  roomName.value = name
  saveStatus.value = 'Bezig met opslaan...'
  saveStatusType.value = 'loading'

  try {
    let saved
    if (currentRoom.value) {
      // Update existing room
      saved = await updateRoom(currentRoom.value._id, { name, sceneData })
    } else {
      // Create new room
      saved = await saveRoom({ name, sceneData })
    }
    saveStatus.value = `✅ Kamer "${saved.name || 'naamloos'}" is succesvol opgeslagen!`
    saveStatusType.value = 'success'
    await loadRooms()

    // Update current room reference if it was a new room
    if (!currentRoom.value) {
      currentRoom.value = saved
    }

    // Laat succesmelding 5 seconden zien
    setTimeout(() => {
      if (saveStatusType.value === 'success') {
        saveStatus.value = ''
        saveStatusType.value = ''
      }
    }, 5000)
  } catch (error) {
    console.error('Failed to save room', error)
    saveStatus.value = `❌ Opslaan mislukt: ${error?.response?.data?.error || error?.message || 'Onbekende fout'}`
    saveStatusType.value = 'error'

    // Laat foutmelding 8 seconden zien
    setTimeout(() => {
      if (saveStatusType.value === 'error') {
        saveStatus.value = ''
        saveStatusType.value = ''
      }
    }, 8000)
  }
}

function onToolbarAction() {
  // Placeholder for toolbar actions while behavior is being defined.
}

function handleRoomNameUpdate(value) {
  roomName.value = value
}

function onHistoryAction() {
  // Placeholder for undo/redo actions while behavior is being defined.
}
</script>

<template>
  <div class="editor-page">
    <div v-if="view === 'home'" class="home-page">
      <div class="home-header">
        <h1>🏠 Noek Kamer Editor</h1>
        <p>Maak en bewerk je virtuele kamers. Klik op een kamer om verder te werken, of maak een nieuwe.</p>

        <div v-if="!authState?.token" class="auth-panel">
          <h3>{{ authMode === 'register' ? 'Nieuw account' : 'Inloggen' }}</h3>
          <div class="auth-row">
            <input v-model="authEmail" type="email" placeholder="Email" autocomplete="email" />
            <input v-model="authPassword" type="password" placeholder="Wachtwoord" autocomplete="current-password" />
            <input
              v-if="authMode === 'register'"
              v-model="authDisplayName"
              type="text"
              placeholder="Weergavenaam (optioneel)"
              autocomplete="nickname"
            />
          </div>
          <div class="auth-actions">
            <button type="button" class="primary-btn" @click="onAuthSubmit">
              {{ authMode === 'register' ? 'Account aanmaken' : 'Inloggen' }}
            </button>
            <button
              type="button"
              class="secondary-btn"
              @click="authMode = authMode === 'register' ? 'login' : 'register'"
            >
              {{ authMode === 'register' ? 'Ik heb al een account' : 'Nieuwe gebruiker' }}
            </button>
          </div>
          <div v-if="authStatus" class="editor-save-status" :class="authStatusType">{{ authStatus }}</div>
        </div>

        <div v-else class="auth-userbar">
          <span>Ingelogd als <strong>{{ authState.user.displayName }}</strong> ({{ authState.user.email }})</span>
          <button type="button" class="secondary-btn" @click="onLogout">Uitloggen</button>
        </div>

        <div class="home-actions">
          <button type="button" class="primary-btn" :disabled="!authState?.token" @click="openEditor()">✨ Nieuwe kamer</button>
          <button type="button" class="secondary-btn" :disabled="!authState?.token" @click="loadRooms">🔄 Ververs lijst</button>
        </div>
      </div>
      <div class="room-list">
        <div v-if="!authState?.token" class="room-empty">
          <div class="empty-icon">🔐</div>
          <h3>Log eerst in</h3>
          <p>Je kamers zijn alleen zichtbaar voor jouw account.</p>
        </div>
        <div v-else-if="rooms.length === 0" class="room-empty">
          <div class="empty-icon">📭</div>
          <h3>Geen kamers gevonden</h3>
          <p>Maak je eerste kamer om te beginnen!</p>
        </div>
        <div v-else class="room-grid">
          <div
            v-for="room in rooms"
            :key="room._id"
            class="room-card"
          >
            <button
              type="button"
              class="room-main-btn"
              @click="openEditor(room)"
            >
              <div class="room-icon">🏠</div>
              <div class="room-info">
                <strong>{{ room.name }}</strong>
                <div class="room-meta">{{ new Date(room.createdAt).toLocaleString('nl-NL') }}</div>
              </div>
            </button>

            <div class="room-actions-row">
              <button type="button" class="secondary-btn" @click="toggleRoomContributions(room)">
                {{ activeContributionsRoomId === room._id ? 'Verberg bestanden' : 'Toon bestanden + attributen' }}
              </button>
            </div>

            <div v-if="activeContributionsRoomId === room._id" class="room-contribution-list">
              <form class="contribution-form" @submit.prevent="addCandleContribution(room)">
                <h4>Nieuw kaarsje toevoegen</h4>
                <div class="contribution-giver">Van: <strong>{{ autoGiverName || '-' }}</strong></div>
                <textarea
                  v-model="newCandleForm.tributeText"
                  rows="3"
                  placeholder="Klein tekstje (max 150 woorden)"
                />
                <div class="contribution-form-meta">
                  <span>{{ countWords(newCandleForm.tributeText) }}/150 woorden</span>
                  <button
                    type="submit"
                    class="primary-btn"
                    :disabled="contributionCreateState.loading || countWords(newCandleForm.tributeText) > 150"
                  >
                    {{ contributionCreateState.loading ? 'Opslaan...' : 'Kaarsje toevoegen' }}
                  </button>
                </div>
                <div v-if="contributionCreateState.error" class="room-contribution-empty error">
                  {{ contributionCreateState.error }}
                </div>
                <div v-else-if="contributionCreateState.success" class="room-contribution-empty success">
                  {{ contributionCreateState.success }}
                </div>
              </form>

              <form class="contribution-form" @submit.prevent="addMusicUrlContribution(room)">
                <h4>Muzieklink toevoegen</h4>
                <div class="contribution-giver">Van: <strong>{{ autoGiverName || '-' }}</strong></div>
                <input
                  v-model="newMusicUrlForm.externalUrl"
                  type="url"
                  placeholder="YouTube of Spotify URL"
                />
                <div
                  v-if="detectedMusicPlatform === 'youtube' && newMusicUrlForm.externalUrl"
                  class="youtube-preview-wrap"
                >
                  <iframe
                    v-if="musicYoutubeEmbedUrl"
                    class="youtube-preview-frame"
                    :src="musicYoutubeEmbedUrl"
                    title="YouTube preview"
                    loading="lazy"
                    referrerpolicy="strict-origin-when-cross-origin"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                  />
                  <div v-else class="room-contribution-empty error">
                    Geen geldige YouTube-link voor preview.
                  </div>
                </div>
                <div
                  v-if="detectedMusicPlatform === 'spotify' && newMusicUrlForm.externalUrl"
                  class="spotify-preview-wrap"
                >
                  <iframe
                    v-if="musicSpotifyEmbedUrl"
                    class="spotify-preview-frame"
                    :src="musicSpotifyEmbedUrl"
                    title="Spotify preview"
                    loading="lazy"
                    referrerpolicy="strict-origin-when-cross-origin"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  />
                  <div v-else class="room-contribution-empty error">
                    Geen geldige Spotify-link voor preview.
                  </div>
                </div>
                <div class="contribution-giver">
                  Platform: <strong>{{ detectedMusicPlatform === 'none' ? 'onbekend' : detectedMusicPlatform }}</strong>
                </div>
                <textarea
                  v-model="newMusicUrlForm.tributeText"
                  rows="3"
                  placeholder="Klein tekstje (max 150 woorden)"
                />
                <div class="contribution-form-meta">
                  <span>{{ countWords(newMusicUrlForm.tributeText) }}/150 woorden</span>
                  <button
                    type="submit"
                    class="primary-btn"
                    :disabled="contributionCreateState.loading || countWords(newMusicUrlForm.tributeText) > 150"
                  >
                    {{ contributionCreateState.loading ? 'Opslaan...' : 'Muzieklink toevoegen' }}
                  </button>
                </div>
              </form>

              <form class="contribution-form" @submit.prevent="addVideoUrlContribution(room)">
                <h4>Videolink toevoegen (YouTube)</h4>
                <div class="contribution-giver">Van: <strong>{{ autoGiverName || '-' }}</strong></div>
                <input
                  v-model="newVideoUrlForm.externalUrl"
                  type="url"
                  placeholder="YouTube URL"
                />
                <div v-if="newVideoUrlForm.externalUrl" class="youtube-preview-wrap">
                  <iframe
                    v-if="videoYoutubeEmbedUrl"
                    class="youtube-preview-frame"
                    :src="videoYoutubeEmbedUrl"
                    title="YouTube preview"
                    loading="lazy"
                    referrerpolicy="strict-origin-when-cross-origin"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                  />
                  <div v-else class="room-contribution-empty error">
                    Geen geldige YouTube-link voor preview.
                  </div>
                </div>
                <textarea
                  v-model="newVideoUrlForm.tributeText"
                  rows="3"
                  placeholder="Klein tekstje (max 150 woorden)"
                />
                <div class="contribution-form-meta">
                  <span>{{ countWords(newVideoUrlForm.tributeText) }}/150 woorden</span>
                  <button
                    type="submit"
                    class="primary-btn"
                    :disabled="contributionCreateState.loading || countWords(newVideoUrlForm.tributeText) > 150"
                  >
                    {{ contributionCreateState.loading ? 'Opslaan...' : 'Videolink toevoegen' }}
                  </button>
                </div>
              </form>

              <form class="contribution-form" @submit.prevent="addPhotoFileContribution(room)">
                <h4>Foto uploaden</h4>
                <div class="contribution-giver">Van: <strong>{{ autoGiverName || '-' }}</strong></div>
                <input
                  :key="photoInputKey"
                  type="file"
                  accept="image/*"
                  @change="handlePhotoFileChange"
                />
                <div v-if="newPhotoFile" class="contribution-giver">Bestand: <strong>{{ newPhotoFile.name }}</strong></div>
                <textarea
                  v-model="newPhotoFileForm.tributeText"
                  rows="3"
                  placeholder="Klein tekstje (max 150 woorden)"
                />
                <div class="contribution-form-meta">
                  <span>{{ countWords(newPhotoFileForm.tributeText) }}/150 woorden</span>
                  <button
                    type="submit"
                    class="primary-btn"
                    :disabled="photoUploadState.loading"
                  >
                    {{ photoUploadState.loading ? 'Uploaden...' : 'Foto uploaden' }}
                  </button>
                </div>
                <div v-if="photoUploadState.error" class="room-contribution-empty error">
                  {{ photoUploadState.error }}
                </div>
                <div v-else-if="photoUploadState.success" class="room-contribution-empty success">
                  {{ photoUploadState.success }}
                </div>
              </form>

              <form class="contribution-form" @submit.prevent="addVideoFileContribution(room)">
                <h4>Videobestand uploaden</h4>
                <div class="contribution-giver">Van: <strong>{{ autoGiverName || '-' }}</strong></div>
                <input
                  :key="videoInputKey"
                  type="file"
                  accept="video/*"
                  @change="handleVideoFileChange"
                />
                <div v-if="newVideoFile" class="contribution-giver">Bestand: <strong>{{ newVideoFile.name }}</strong></div>
                <textarea
                  v-model="newVideoFileForm.tributeText"
                  rows="3"
                  placeholder="Klein tekstje (max 150 woorden)"
                />
                <div class="contribution-form-meta">
                  <span>{{ countWords(newVideoFileForm.tributeText) }}/150 woorden</span>
                  <button
                    type="submit"
                    class="primary-btn"
                    :disabled="videoFileUploadState.loading"
                  >
                    {{ videoFileUploadState.loading ? 'Uploaden...' : 'Video uploaden' }}
                  </button>
                </div>
                <div v-if="videoFileUploadState.error" class="room-contribution-empty error">
                  {{ videoFileUploadState.error }}
                </div>
                <div v-else-if="videoFileUploadState.success" class="room-contribution-empty success">
                  {{ videoFileUploadState.success }}
                </div>
              </form>

              <div v-if="contributionLoadState.loadingRoomId === room._id" class="room-contribution-empty">
                Bestanden laden...
              </div>
              <div v-else-if="contributionLoadState.error" class="room-contribution-empty error">
                {{ contributionLoadState.error }}
              </div>
              <div v-else-if="(roomContributions[room._id] || []).length === 0" class="room-contribution-empty">
                Nog geen bestanden of bijdragen voor deze kamer.
              </div>
              <ul v-else class="room-contribution-items">
                <li
                  v-for="item in roomContributions[room._id]"
                  :key="item._id"
                  class="room-contribution-item"
                >
                  <div><strong>Type:</strong> {{ item.type }}</div>
                  <div><strong>Gever:</strong> {{ item.giverName || '-' }}</div>
                  <div><strong>Tekst:</strong> {{ item.tributeText || '-' }}</div>
                  <div><strong>Media URL:</strong> {{ item.mediaUrl || '-' }}</div>
                  <div><strong>Externe URL:</strong> {{ item.externalUrl || '-' }}</div>
                  <div><strong>Platform:</strong> {{ item.platform || 'none' }}</div>
                  <div class="item-reactions-row">
                    <strong>Reacties:</strong>
                    <button
                      type="button"
                      class="reaction-chip"
                      :class="{ active: getUserReaction(item) === 'heart' }"
                      @click="reactOnContribution(room._id, item._id, 'heart')"
                    >
                      ❤️ {{ item.reactions?.heartCount || 0 }}
                    </button>
                    <button
                      type="button"
                      class="reaction-chip"
                      :class="{ active: getUserReaction(item) === 'support' }"
                      @click="reactOnContribution(room._id, item._id, 'support')"
                    >
                      🤍 {{ item.reactions?.supportCount || 0 }}
                    </button>
                    <button
                      type="button"
                      class="reaction-chip"
                      :class="{ active: getUserReaction(item) === 'candle' }"
                      @click="reactOnContribution(room._id, item._id, 'candle')"
                    >
                      🕯️ {{ item.reactions?.candleCount || 0 }}
                    </button>
                  </div>

                  <form class="item-comment-form" @submit.prevent="submitContributionComment(room._id, item._id)">
                    <input
                      v-model="commentDrafts[item._id]"
                      type="text"
                      maxlength="500"
                      placeholder="Laat een reactie achter..."
                    />
                    <button
                      type="submit"
                      class="secondary-btn"
                      :disabled="commentStateByItem[item._id]?.loading"
                    >
                      {{ commentStateByItem[item._id]?.loading ? 'Bezig...' : 'Plaats reactie' }}
                    </button>
                  </form>
                  <div v-if="commentStateByItem[item._id]?.error" class="room-contribution-empty error">
                    {{ commentStateByItem[item._id].error }}
                  </div>

                  <div class="item-comments-list">
                    <strong>Comments ({{ item.comments?.length || 0 }}):</strong>
                    <div v-if="!item.comments?.length" class="room-contribution-empty">
                      Nog geen comments.
                    </div>
                    <ul v-else class="item-comments-items">
                      <li v-for="comment in item.comments" :key="comment._id || comment.createdAt" class="item-comment-entry">
                        <span class="item-comment-author">{{ comment.displayName || 'Gebruiker' }}:</span>
                        <span>{{ comment.text }}</span>
                      </li>
                    </ul>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="editor-shell">
      <button type="button" class="home-icon-btn" @click="showHome" title="Terug naar home">
        🏠
      </button>

      <EditorTopLeftControls
        @settings="onToolbarAction"
        @home="onToolbarAction"
        @save="onSave"
        @share="onToolbarAction"
      />

      <EditorRoomName
        :room-name="roomName.value"
        @update:roomName="handleRoomNameUpdate"
      />

      <div class="editor-save-status" :class="saveStatusType" v-if="saveStatus">
        {{ saveStatus }}
      </div>

      <EditorBrand name="Thibaut DELA" sub="Uitvaartzorg" />

      <EditorHistoryControls @undo="onHistoryAction" @redo="onHistoryAction" />

      <div class="editor-content">
        <Sidebar
          class="editor-sidebar"
          :selected="selected"
          @load-model="onLoadModel"
          @delete-selected="onDeleteSelected"
        />

        <div class="editor-scene-panel">
          <ThreeScene
            ref="sceneRef"
            class="editor-scene"
            :load-request="loadRequest"
            :scene-command="sceneCommand"
            :room-data="currentRoomData"
            @selected="onSelected"
            @selected-anchor="onSelectedAnchor"
            @load-error="onLoadError"
          />

          <SceneOverlays
            :error-message="lastLoadError"
            :selected="selected"
            :selected-anchor="selectedAnchor"
            @delete-selected="onDeleteSelected"
          />
        </div>
      </div>
    </div>
  </div>
</template>
