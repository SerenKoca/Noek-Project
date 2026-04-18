import { ref, computed, nextTick } from 'vue'
import {
  saveRoom,
  updateRoom,
  deleteRoom,
  getRooms,
  getRoomContributions,
  createRoomContribution,
  reactToRoomContribution,
  addRoomContributionComment,
  updateRoomMusic,
  reactToRoom,
  addRoomComment
} from '../services/roomService.js'
import { getSoundLibrary } from '../services/soundLibraryService.js'
import { loginAccount, registerAccount, getStoredAuth, clearAuth } from '../services/authService.js'

const rooms = ref([])
const authState = ref(getStoredAuth())
const authEmail = ref('')
const authPassword = ref('')
const authDisplayName = ref('')
const authRegistrationCode = ref('')
const authRegisterRole = ref('editor')
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
const saveStatusType = ref('')
const currentRoomData = ref(null)
const currentRoom = ref(null)
const activeContributionsRoomId = ref('')
const settingsRoom = ref(null)
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
const roomMusicDraftUrl = ref('')
const roomMusicDraftVolume = ref(35)
const roomMusicState = ref({ loading: false, error: '', success: '' })
const roomAppearanceDraft = ref({ floorColor: '#c0b496', wallColor: '#8f98a3' })
const availableSounds = ref([])
const roomCommentDraft = ref('')
const roomCommentState = ref({ loading: false, error: '' })
const audioPlayer = ref(null)
const deleteRoomModal = ref({
  open: false,
  roomId: '',
  roomName: '',
  typedName: '',
  loading: false,
  error: ''
})

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
const currentRoomSoundTitle = computed(() => {
  const url = String(roomMusicDraftUrl.value || '').trim()
  if (!url) return 'Geen geluid gekozen'

  const fromLibrary = (availableSounds.value || []).find((sound) => sound.url === url)
  if (fromLibrary?.title) return fromLibrary.title

  const last = url.split('/').pop() || url
  return decodeURIComponent(last).replace(/\.[^/.]+$/, '')
})

const DEFAULT_FLOOR_COLOR = '#c0b496'
const DEFAULT_WALL_COLOR = '#8f98a3'
let initialized = false

function normalizeHexColor(value, fallback) {
  const input = String(value || '').trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(input)) return input
  return fallback
}

async function loadAvailableSounds() {
  const res = await getSoundLibrary()
  availableSounds.value = Array.isArray(res.sounds) ? res.sounds : []
}

function syncRoomMusicDraft(room) {
  roomMusicDraftUrl.value = room?.ambience?.musicUrl || ''
  roomMusicDraftVolume.value = Math.round((room?.ambience?.volume ?? 0.35) * 100)
  roomMusicState.value = { loading: false, error: '', success: '' }
}

function syncRoomAppearanceDraft(room) {
  const appearance = room?.sceneData?.appearance || {}
  roomAppearanceDraft.value = {
    floorColor: normalizeHexColor(appearance.floorColor, DEFAULT_FLOOR_COLOR),
    wallColor: normalizeHexColor(appearance.wallColor, DEFAULT_WALL_COLOR)
  }
}

function stopRoomAudio() {
  if (!audioPlayer.value) return
  audioPlayer.value.pause()
  audioPlayer.value.src = ''
}

function onRoomMusicVolumeInput() {
  if (!audioPlayer.value) return
  const volume = Math.min(1, Math.max(0, Number(roomMusicDraftVolume.value) / 100))
  audioPlayer.value.volume = volume
}

async function startRoomAudioFromRoom(room) {
  const musicUrl = String(room?.ambience?.musicUrl || '').trim()
  if (!musicUrl) {
    stopRoomAudio()
    return
  }

  if (!audioPlayer.value) {
    audioPlayer.value = new Audio()
    audioPlayer.value.loop = true
  }

  const volume = Math.min(1, Math.max(0, Number(room?.ambience?.volume ?? 0.35)))
  audioPlayer.value.volume = volume
  audioPlayer.value.src = musicUrl

  try {
    await audioPlayer.value.play()
  } catch {
    roomMusicState.value = {
      loading: false,
      error: 'Auto-play geblokkeerd door browser. Klik op "Muziek toepassen".',
      success: ''
    }
  }
}

function mergeRoomUpdate(updatedRoom) {
  if (!updatedRoom?._id) return
  currentRoom.value = updatedRoom
  settingsRoom.value = settingsRoom.value?._id === updatedRoom._id ? updatedRoom : settingsRoom.value
  rooms.value = (rooms.value || []).map((room) => (room._id === updatedRoom._id ? updatedRoom : room))
}

function getUserRoomReaction(room) {
  const userId = currentUserId.value
  if (!userId) return ''
  const entry = (room?.roomReactedUsers || []).find((row) => row?.userId === userId)
  return entry?.reactionType || ''
}

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

function onDeleteRoom(room) {
  if (!room?._id) return

  deleteRoomModal.value = {
    open: true,
    roomId: room._id,
    roomName: String(room.name || '').trim(),
    typedName: '',
    loading: false,
    error: ''
  }
}

function closeDeleteRoomModal() {
  deleteRoomModal.value = {
    open: false,
    roomId: '',
    roomName: '',
    typedName: '',
    loading: false,
    error: ''
  }
}

async function confirmDeleteRoomFromModal() {
  const roomId = deleteRoomModal.value.roomId
  const roomName = deleteRoomModal.value.roomName
  const typedName = (deleteRoomModal.value.typedName || '').trim()

  if (!roomId || !roomName) return

  if (typedName !== roomName) {
    deleteRoomModal.value.error = 'Naam komt niet exact overeen.'
    return
  }

  deleteRoomModal.value.loading = true
  deleteRoomModal.value.error = ''

  try {
    await deleteRoom(roomId)

    if (activeContributionsRoomId.value === roomId) {
      activeContributionsRoomId.value = ''
      contributionLoadState.value = { loadingRoomId: '', error: '' }
    }

    closeDeleteRoomModal()
    await loadRooms()
  } catch (error) {
    console.error('Failed to delete room', error)
    deleteRoomModal.value.loading = false
    deleteRoomModal.value.error = error?.response?.data?.error || 'Kamer verwijderen mislukt.'
  }
}

async function ensureRoomContributionsLoaded(roomId) {
  if (!roomId) return

  activeContributionsRoomId.value = roomId
  contributionLoadState.value = { loadingRoomId: roomId, error: '' }

  try {
    const items = await getRoomContributions(roomId)
    roomContributions.value = {
      ...roomContributions.value,
      [roomId]: Array.isArray(items) ? items : []
    }
    contributionLoadState.value = { loadingRoomId: '', error: '' }
  } catch (error) {
    console.error('Failed to load room contributions', error)
    roomContributions.value = {
      ...roomContributions.value,
      [roomId]: []
    }
    contributionLoadState.value = {
      loadingRoomId: '',
      error: error?.response?.data?.error || 'Kon bijdragen niet laden.'
    }
  }
}

async function openRoomSettings(room) {
  if (!room?._id) return
  settingsRoom.value = room
  resetContributionDrafts()
  contributionCreateState.value = { loading: false, error: '', success: '' }
  await ensureRoomContributionsLoaded(room._id)
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
    photoUploadState.value = { loading: false, error: '', success: 'Foto geupload.' }
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
    videoFileUploadState.value = { loading: false, error: '', success: 'Video geupload.' }
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
  selected.value = null
  selectedAnchor.value = null
  lastLoadError.value = ''
  roomName.value = room?.name || 'Naam kamer'
  saveStatus.value = ''
  saveStatusType.value = ''

  currentRoom.value = room
  syncRoomMusicDraft(room)
  roomCommentDraft.value = ''
  roomCommentState.value = { loading: false, error: '' }
  await startRoomAudioFromRoom(room)

  const roomData = room?.sceneData ? JSON.parse(JSON.stringify(room.sceneData)) : null
  currentRoomData.value = roomData
  syncRoomAppearanceDraft(room)
}

function showHome() {
  saveStatus.value = ''
  saveStatusType.value = ''
  currentRoomData.value = null
  currentRoom.value = null
  roomAppearanceDraft.value = { floorColor: DEFAULT_FLOOR_COLOR, wallColor: DEFAULT_WALL_COLOR }
  stopRoomAudio()
  activeContributionsRoomId.value = ''
  resetContributionDrafts()
  contributionCreateState.value = { loading: false, error: '', success: '' }
  settingsRoom.value = null
}

async function onAuthSubmit() {
  authStatus.value = ''
  authStatusType.value = ''

  const email = authEmail.value.trim()
  const password = authPassword.value
  const displayName = authDisplayName.value.trim()
  const registrationCode = authRegistrationCode.value.trim()
  const registerRole = authRegisterRole.value === 'visitor' ? 'visitor' : 'editor'

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

  if (authMode.value === 'register' && registerRole === 'editor' && !registrationCode) {
    authStatus.value = 'Registratiecode is verplicht.'
    authStatusType.value = 'error'
    return
  }

  authStatus.value = authMode.value === 'register' ? 'Account aanmaken...' : 'Inloggen...'
  authStatusType.value = 'loading'

  try {
    const result = authMode.value === 'register'
      ? await registerAccount({ email, password, displayName, registrationCode, registerRole })
      : await loginAccount({ email, password })

    authState.value = result
    authPassword.value = ''
    authRegistrationCode.value = ''
    authRegisterRole.value = 'editor'
    authStatus.value = `Welkom ${result?.user?.displayName || result?.user?.email || ''}`
    authStatusType.value = 'success'
    if (result?.user?.role === 'editor') {
      await loadRooms()
    } else {
      rooms.value = []
    }
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
  settingsRoom.value = null
  stopRoomAudio()
  authStatus.value = 'Je bent uitgelogd.'
  authStatusType.value = 'success'
}

async function onSaveRoomMusic() {
  const roomId = currentRoom.value?._id
  if (!roomId) {
    roomMusicState.value = { loading: false, error: 'Sla eerst je kamer op.', success: '' }
    return
  }

  roomMusicState.value = { loading: true, error: '', success: '' }

  try {
    const updatedRoom = await updateRoomMusic(roomId, {
      musicUrl: roomMusicDraftUrl.value,
      volume: roomMusicDraftVolume.value / 100
    })
    mergeRoomUpdate(updatedRoom)
    await startRoomAudioFromRoom(updatedRoom)
    roomMusicState.value = { loading: false, error: '', success: 'Kamermuziek opgeslagen.' }
  } catch (error) {
    roomMusicState.value = {
      loading: false,
      error: error?.response?.data?.error || 'Kamermuziek opslaan mislukt.',
      success: ''
    }
  }
}

async function reactOnRoom(reactionType) {
  const roomId = currentRoom.value?._id
  if (!roomId) return

  try {
    const updatedRoom = await reactToRoom(roomId, reactionType)
    mergeRoomUpdate(updatedRoom)
  } catch (error) {
    console.error('Failed to react on room', error)
  }
}

async function submitRoomComment() {
  const roomId = currentRoom.value?._id
  const text = roomCommentDraft.value.trim()
  if (!roomId || !text) return

  roomCommentState.value = { loading: true, error: '' }

  try {
    const updatedRoom = await addRoomComment(roomId, {
      text,
      displayName: autoGiverName.value || 'Gebruiker'
    })
    mergeRoomUpdate(updatedRoom)
    roomCommentDraft.value = ''
    roomCommentState.value = { loading: false, error: '' }
  } catch (error) {
    roomCommentState.value = {
      loading: false,
      error: error?.response?.data?.error || 'Kamerreactie opslaan mislukt.'
    }
  }
}

function onLoadModel(modelLike) {
  loadRequest.value = { ...modelLike, _requestId: Date.now() }
}

function onDeleteSelected() {
  sceneCommand.value = { type: 'delete-selected', _requestId: Date.now() }
}

async function onSelectRoomSound(sound) {
  const soundUrl = String(sound?.url || '').trim()
  if (!soundUrl) return

  roomMusicDraftUrl.value = soundUrl

  if (!currentRoom.value?._id) {
    roomMusicState.value = {
      loading: false,
      error: 'Sla eerst je kamer op, daarna kan je het geluid toepassen.',
      success: ''
    }
    return
  }

  await onSaveRoomMusic()
}

function onApplyRoomColors(colors) {
  roomAppearanceDraft.value = {
    floorColor: normalizeHexColor(colors?.floorColor, DEFAULT_FLOOR_COLOR),
    wallColor: normalizeHexColor(colors?.wallColor, DEFAULT_WALL_COLOR)
  }

  sceneCommand.value = {
    type: 'apply-room-colors',
    floorColor: roomAppearanceDraft.value.floorColor,
    wallColor: roomAppearanceDraft.value.wallColor,
    _requestId: Date.now()
  }
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
    await nextTick()
  }

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
      saved = await updateRoom(currentRoom.value._id, { name, sceneData })
    } else {
      saved = await saveRoom({ name, sceneData })
    }
    saveStatus.value = `Kamer "${saved.name || 'naamloos'}" is succesvol opgeslagen!`
    saveStatusType.value = 'success'
    await loadRooms()

    if (!currentRoom.value) {
      currentRoom.value = saved
    }

    setTimeout(() => {
      if (saveStatusType.value === 'success') {
        saveStatus.value = ''
        saveStatusType.value = ''
      }
    }, 5000)
  } catch (error) {
    console.error('Failed to save room', error)
    saveStatus.value = `Opslaan mislukt: ${error?.response?.data?.error || error?.message || 'Onbekende fout'}`
    saveStatusType.value = 'error'

    setTimeout(() => {
      if (saveStatusType.value === 'error') {
        saveStatus.value = ''
        saveStatusType.value = ''
      }
    }, 8000)
  }
}

function onToolbarAction() {
}

function handleRoomNameUpdate(value) {
  roomName.value = value
}

function onHistoryAction() {
}

async function bootstrap() {
  if (initialized) return
  initialized = true

  await loadAvailableSounds()
  if (authState.value?.token) {
    await loadRooms()
  }
}

function getRoomById(roomId) {
  return (rooms.value || []).find((room) => room._id === roomId) || null
}

export function useNoekState() {
  return {
    rooms,
    authState,
    authEmail,
    authPassword,
    authDisplayName,
    authRegistrationCode,
    authRegisterRole,
    authMode,
    authStatus,
    authStatusType,
    loadRequest,
    selected,
    selectedAnchor,
    lastLoadError,
    sceneCommand,
    sceneRef,
    roomName,
    saveStatus,
    saveStatusType,
    currentRoomData,
    currentRoom,
    activeContributionsRoomId,
    settingsRoom,
    roomContributions,
    contributionLoadState,
    newCandleForm,
    newMusicUrlForm,
    newVideoUrlForm,
    newPhotoFile,
    newVideoFile,
    newPhotoFileForm,
    newVideoFileForm,
    photoInputKey,
    videoInputKey,
    contributionCreateState,
    photoUploadState,
    videoFileUploadState,
    commentDrafts,
    commentStateByItem,
    roomMusicDraftUrl,
    roomMusicDraftVolume,
    roomMusicState,
    roomAppearanceDraft,
    availableSounds,
    roomCommentDraft,
    roomCommentState,
    deleteRoomModal,
    currentUserId,
    autoGiverName,
    detectedMusicPlatform,
    musicYoutubeVideoId,
    videoYoutubeVideoId,
    musicYoutubeEmbedUrl,
    musicSpotifyEmbedUrl,
    videoYoutubeEmbedUrl,
    currentRoomSoundTitle,
    loadRooms,
    onDeleteRoom,
    closeDeleteRoomModal,
    confirmDeleteRoomFromModal,
    ensureRoomContributionsLoaded,
    openRoomSettings,
    addCandleContribution,
    addMusicUrlContribution,
    addVideoUrlContribution,
    addPhotoFileContribution,
    addVideoFileContribution,
    reactOnContribution,
    getUserReaction,
    submitContributionComment,
    openEditor,
    showHome,
    onAuthSubmit,
    onLogout,
    onSaveRoomMusic,
    reactOnRoom,
    submitRoomComment,
    onLoadModel,
    onDeleteSelected,
    onSelectRoomSound,
    onApplyRoomColors,
    onSelected,
    onSelectedAnchor,
    onLoadError,
    onSave,
    onToolbarAction,
    handleRoomNameUpdate,
    onHistoryAction,
    onRoomMusicVolumeInput,
    getUserRoomReaction,
    countWords,
    handlePhotoFileChange,
    handleVideoFileChange,
    resetContributionDrafts,
    bootstrap,
    getRoomById
  }
}
