<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ThreeScene from '../components/ThreeScene.vue'
import VR3DScene from '../components/VR3DScene.vue'
import {
  addPublicRoomComment,
  addPublicRoomContributionComment,
  createPublicRoomContribution,
  getPublicRoom,
  getPublicRoomContributions,
  reactToPublicRoom,
  reactToPublicRoomContribution
} from '../services/visitorService.js'
import { getStoredAuth } from '../services/authService.js'
import { applyBrandingTheme, normalizeBranding } from '../services/brandTheme.js'

const VISITOR_NAME_STORAGE = 'noek_visitor_name'
const VISITOR_ENTRY_STORAGE = 'noek_visitor_entry_seen'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => String(route.params.id || ''))

const room = ref(null)
const contributions = ref([])
const loading = ref(false)
const error = ref('')
const submitState = ref({ loading: false, error: '', success: '' })
const profileHint = ref('')
const hasEnteredRoom = ref(false)
const introLoading = ref(false)
const commentDrafts = ref({})
const commentStateByItem = ref({})
const audioPlayer = ref(null)
const roomMusicState = ref({ loading: false, error: '', playing: false })
const activePanel = ref('none')
const galleryMode = ref('gallery')
const galleryPage = ref(0)
const roomMode = ref('room')
const gallerySelectedId = ref('')
const selectedCategory = computed(() => normalizeGalleryCategory(route.params.category))
const isGalleryPage = computed(() => Boolean(selectedCategory.value))
const isVrMode = computed(() => galleryMode.value === 'vr' && selectedCategory.value === 'photos')
const showVrToggle = computed(() => selectedCategory.value === 'photos')
const isRoomVrMode = computed(() => roomMode.value === 'vr' && !isGalleryPage.value)
const galleryCategoryLabel = computed(() => {
  const map = {
    photos: "Foto's",
    music: 'Muziek',
    videos: "Video's"
  }
  return map[selectedCategory.value] || 'Bijdragen'
})
const galleryHeading = computed(() => {
  const map = {
    photos: 'Alle fotoherinneringen',
    music: 'Alle muziekbijdragen',
    videos: 'Alle videobijdragen'
  }
  return map[selectedCategory.value] || 'Alle bijdragen'
})
const galleryLead = computed(() => {
  const map = {
    photos: 'Bekijk de foto’s in een rustig overzicht en voeg zelf een foto toe.',
    music: 'Luister naar muziek die herinneringen vasthoudt en vul de ruimte aan.',
    videos: 'Bekijk alle video’s en deel een nieuwe herinnering met beeld.'
  }
  return map[selectedCategory.value] || 'Bekijk alle bijdragen in deze ruimte.'
})
const galleryActionLabel = computed(() => {
  const map = {
    photos: 'Voeg foto toe',
    music: 'Voeg muziek toe',
    videos: 'Voeg video toe'
  }
  return map[selectedCategory.value] || 'Voeg bijdrage toe'
})

const auth = ref(getStoredAuth())
const isLoggedIn = computed(() => Boolean(auth.value?.token))
const authDisplayName = computed(() => {
  const fromProfile = String(auth.value?.user?.displayName || '').trim()
  if (fromProfile) return fromProfile
  const fromEmail = String(auth.value?.user?.email || '').trim()
  return fromEmail ? (fromEmail.split('@')[0] || '') : ''
})

const visitorName = ref('')
const editingVisitorName = ref(false)
const nameInput = ref(null)
const tributeText = ref('')
const type = ref('candle')
const externalUrl = ref('')
const mediaUrl = ref('')
const roomCommentText = ref('')
const roomCommentInput = ref(null)
const mediaFile = ref(null)
const mediaPreviewUrl = ref('')
const photosStep = ref(1)
const videoStep = ref(1)
const musicStep = ref(1)
const candleStep = ref(1)
const candlePanelMode = ref('create')
const selectedCandleFromScene = ref(null)
const musicUrlInput = ref('')
const musicPreviewEmbed = ref('')
const videoUrlInput = ref('')
const videoPreviewEmbed = ref('')

const logoTitle = ref('Thibaut DELA')
const logoSubtitle = ref('Uitvaartzorg')
const brandLogoUrl = ref('')
const entryLogoSrc = computed(() => brandLogoUrl.value || '/img/logo-noek.svg')

const roomSceneData = computed(() => room.value?.sceneData || null)

const roomTitle = computed(() => {
  const name = String(room.value?.name || '').trim()
  return name ? `${name}'s herdenkingsruimte` : 'Herdenkingsruimte'
})

const panelTitle = computed(() => {
  const map = {
    photos: "Foto's",
    music: 'Muziek',
    videos: "Video's",
    'photos-steps': 'Media',
    'candles-steps': 'Kaarsjes',
    candles: 'Kaarsjes',
    messages: 'Bericht',
    tutorial: 'Tutorial'
  }
  return map[activePanel.value] || 'Paneel'
})

const isCandleDetailsPanel = computed(() => {
  return activePanel.value === 'candles-steps' && candlePanelMode.value === 'details' && Boolean(selectedCandleFromScene.value)
})

const candleDetailsHeading = computed(() => {
  const giver = String(selectedCandleFromScene.value?.giverName || '').trim()
  return giver ? `Kaars van ${giver}` : 'Kaars'
})

const filteredContributions = computed(() => {
  const items = Array.isArray(contributions.value) ? contributions.value : []

  if (selectedCategory.value === 'photos') return items.filter((item) => item.type === 'photo')
  if (selectedCategory.value === 'music') return items.filter((item) => item.type === 'music_url')
  if (selectedCategory.value === 'videos') return items.filter((item) => item.type === 'video_file' || item.type === 'video_url')
  return items
})

const galleryPageSize = computed(() => (selectedCategory.value === 'photos' ? 8 : 4))

const galleryPageCount = computed(() => {
  const total = filteredContributions.value.length
  if (!total) return 1
  return Math.max(1, Math.ceil(total / galleryPageSize.value))
})

const pagedContributions = computed(() => {
  const size = galleryPageSize.value
  const page = Math.min(galleryPage.value, galleryPageCount.value - 1)
  const start = page * size
  return filteredContributions.value.slice(start, start + size)
})

const hasMultipleGalleryPages = computed(() => filteredContributions.value.length > galleryPageSize.value)

const gallerySelectedIndex = computed(() => {
  const id = String(gallerySelectedId.value || '').trim()
  if (!id) return -1
  return filteredContributions.value.findIndex((item) => String(item?._id || '') === id)
})

const gallerySelectedItem = computed(() => {
  if (gallerySelectedIndex.value < 0) return null
  return filteredContributions.value[gallerySelectedIndex.value] || null
})

const galleryReactionsOpen = ref(false)
  const roomReactionsOpen = ref(false)

const roomPhotoItems = computed(() => {
  const items = Array.isArray(contributions.value) ? contributions.value : []
  return items.filter((item) => item.type === 'photo' && item.mediaUrl).slice(0, 12)
})

const candleContributions = computed(() => {
  const items = Array.isArray(contributions.value) ? contributions.value : []
  return items.filter((item) => item.type === 'candle')
})

function upsertContributionList(list, contribution) {
  const items = Array.isArray(list) ? [...list] : []
  const nextItem = contribution && typeof contribution === 'object' ? contribution : null
  const contributionId = String(nextItem?._id || '').trim()

  if (!nextItem) return items

  if (!contributionId) {
    items.unshift(nextItem)
    return items
  }

  const index = items.findIndex((item) => String(item?._id || '').trim() === contributionId)
  if (index >= 0) {
    items[index] = {
      ...items[index],
      ...nextItem
    }
    return items
  }

  items.unshift(nextItem)
  return items
}

const vrGalleryItems = computed(() => {
  const items = filteredContributions.value.filter((item) => item.type === 'photo' && item.mediaUrl)
  return items.slice(0, 12)
})

function readStoredEntryState(roomIdValue) {
  if (typeof window === 'undefined' || !roomIdValue) return false
  try {
    const parsed = JSON.parse(window.localStorage.getItem(VISITOR_ENTRY_STORAGE) || '{}')
    return Boolean(parsed?.[roomIdValue])
  } catch {
    return false
  }
}

function persistEntryState(roomIdValue) {
  if (typeof window === 'undefined' || !roomIdValue) return
  try {
    const parsed = JSON.parse(window.localStorage.getItem(VISITOR_ENTRY_STORAGE) || '{}')
    parsed[roomIdValue] = true
    window.localStorage.setItem(VISITOR_ENTRY_STORAGE, JSON.stringify(parsed))
  } catch {
    window.localStorage.setItem(VISITOR_ENTRY_STORAGE, JSON.stringify({ [roomIdValue]: true }))
  }
}

function readStoredVisitorName() {
  if (typeof window === 'undefined') return ''
  return String(window.localStorage.getItem(VISITOR_NAME_STORAGE) || '').trim()
}

function persistVisitorName(value) {
  if (typeof window === 'undefined') return
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    window.localStorage.removeItem(VISITOR_NAME_STORAGE)
    return
  }
  window.localStorage.setItem(VISITOR_NAME_STORAGE, trimmed)
}

function applyRoomBranding(roomData) {
  const normalized = normalizeBranding(roomData?.branding || {})
  logoTitle.value = normalized.directorName || 'Noek'
  logoSubtitle.value = 'Uitvaartzorg'
  brandLogoUrl.value = normalized.logoUrl
  applyBrandingTheme(normalized)
}

function applyVisitorName() {
  const trimmed = String(visitorName.value || '').trim()
  visitorName.value = trimmed || authDisplayName.value || 'Naam'
  persistVisitorName(visitorName.value)
}

async function startEditVisitorName() {
  if (isLoggedIn.value) {
    await openProfile()
    return
  }
  editingVisitorName.value = true
  await nextTick()
  try { if (nameInput.value) nameInput.value.focus() } catch (e) {}
}

function finishEditVisitorName() {
  applyVisitorName()
  editingVisitorName.value = false
}

function ensureVisitorBootState() {
  hasEnteredRoom.value = readStoredEntryState(roomId.value)

  const saved = readStoredVisitorName()
  if (saved) {
    visitorName.value = saved
  } else {
    visitorName.value = authDisplayName.value || 'Naam'
    persistVisitorName(visitorName.value)
  }

}

function normalizeGalleryCategory(rawCategory) {
  const value = String(rawCategory || '').trim().toLowerCase()
  if (!value) return ''
  if (['photo', 'photos', 'foto', 'fotos'].includes(value)) return 'photos'
  if (['music', 'muziek'].includes(value)) return 'music'
  if (['video', 'videos', 'video\'s'].includes(value)) return 'videos'
  return ''
}

function goToGallery(category) {
  if (!roomId.value) return
  try { sessionStorage.removeItem('noek_open_panel') } catch (e) {}
  router.push(`/visit/${roomId.value}/${category}`)
}

function goToOverview() {
  if (!roomId.value) return
  router.push(`/visit/${roomId.value}`)
}

function enterVrMode() {
  if (selectedCategory.value !== 'photos') return
  galleryMode.value = 'vr'
}

function goToNextGalleryPage() {
  if (!hasMultipleGalleryPages.value) return
  galleryPage.value = (galleryPage.value + 1) % galleryPageCount.value
}

function openGalleryItem(item) {
  if (!item?._id) return
  gallerySelectedId.value = String(item._id)
  galleryReactionsOpen.value = false
}

function closeGalleryItem() {
  gallerySelectedId.value = ''
  galleryReactionsOpen.value = false
}

function toggleGalleryReactions() {
  galleryReactionsOpen.value = !galleryReactionsOpen.value
}

function toggleRoomReactions() {
  roomReactionsOpen.value = !roomReactionsOpen.value
}

function goToNextGalleryItem() {
  if (!filteredContributions.value.length) return

  const currentIndex = gallerySelectedIndex.value
  if (currentIndex < 0) {
    const first = filteredContributions.value[0]
    gallerySelectedId.value = String(first?._id || '')
    return
  }

  const nextIndex = (currentIndex + 1) % filteredContributions.value.length
  const nextItem = filteredContributions.value[nextIndex]
  gallerySelectedId.value = String(nextItem?._id || '')
}

function exitVrMode() {
  galleryMode.value = 'gallery'
}

function enterRoomVrMode() {
  roomMode.value = 'vr'
}

function exitRoomVrMode() {
  roomMode.value = 'room'
}

async function openGalleryComposer(cat) {
  const category = String(cat || selectedCategory.value || 'photos')
  try { console.log('openGalleryComposer called, category=', category, 'route.path=', route.path) } catch (e) {}
  if (category === 'photos') {
    if (!roomId.value) return
    // set a session flag and navigate back to the room overview so the
    // newly mounted page can open the steps panel reliably
    try {
      const payload = JSON.stringify({ panel: 'photos-steps', ts: Date.now() })
      sessionStorage.setItem('noek_open_panel', payload)
    } catch (e) {}

    // If we're already on the room path, open immediately without navigating
    try {
      const targetPath = `/visit/${roomId.value}`
      if (route.path === targetPath) {
        try {
          const raw = sessionStorage.getItem('noek_open_panel')
          if (raw) {
            const parsed = JSON.parse(raw)
            const age = Date.now() - Number(parsed?.ts || 0)
            if (parsed?.panel === 'photos-steps' && age >= 0 && age < 5000) {
              sessionStorage.removeItem('noek_open_panel')
              activePanel.value = 'photos-steps'
              return
            }
          }
        } catch (e) {}
      }

      await router.push({ path: `/visit/${roomId.value}` })

      // After navigation, try to open the panel (component may stay mounted)
      try {
        const raw = sessionStorage.getItem('noek_open_panel')
        if (raw) {
          const parsed = JSON.parse(raw)
          const age = Date.now() - Number(parsed?.ts || 0)
          if (parsed?.panel === 'photos-steps' && age >= 0 && age < 5000) {
            sessionStorage.removeItem('noek_open_panel')
            activePanel.value = 'photos-steps'
          }
        }
      } catch (e) {}
    } catch (e) {
      // ignore navigation errors
    }
  } else if (category === 'music') {
    if (!roomId.value) return
    // mirror photos flow: set session flag and navigate to room overview
    try {
      const payload = JSON.stringify({ panel: 'music-steps', ts: Date.now() })
      sessionStorage.setItem('noek_open_panel', payload)
    } catch (e) {}

    // If we're already on the room path, open immediately without navigating
    try {
      const targetPath = `/visit/${roomId.value}`
      if (route.path === targetPath) {
        try {
          const raw = sessionStorage.getItem('noek_open_panel')
          if (raw) {
            const parsed = JSON.parse(raw)
            const age = Date.now() - Number(parsed?.ts || 0)
            if (parsed?.panel === 'music-steps' && age >= 0 && age < 5000) {
              sessionStorage.removeItem('noek_open_panel')
              closeGalleryItem()
              galleryReactionsOpen.value = false
              galleryMode.value = 'gallery'
              activePanel.value = 'music-steps'
              musicStep.value = 1
              musicUrlInput.value = ''
              musicPreviewEmbed.value = ''
              type.value = 'music_url'
              submitState.value = { loading: false, error: '', success: '' }
              return
            }
          }
        } catch (e) {}
      }

      await router.push({ path: `/visit/${roomId.value}` })

      // After navigation, try to open the panel (component may stay mounted)
      try {
        const raw = sessionStorage.getItem('noek_open_panel')
        if (raw) {
          const parsed = JSON.parse(raw)
          const age = Date.now() - Number(parsed?.ts || 0)
          if (parsed?.panel === 'music-steps' && age >= 0 && age < 5000) {
            sessionStorage.removeItem('noek_open_panel')
            closeGalleryItem()
            galleryReactionsOpen.value = false
            galleryMode.value = 'gallery'
            activePanel.value = 'music-steps'
            musicStep.value = 1
            musicUrlInput.value = ''
            musicPreviewEmbed.value = ''
            type.value = 'music_url'
            submitState.value = { loading: false, error: '', success: '' }
          }
        }
      } catch (e) {}
    } catch (e) {
      // ignore navigation errors
    }
  } else if (category === 'candles') {
    if (!roomId.value) return
    try {
      const payload = JSON.stringify({ panel: 'candles-steps', ts: Date.now() })
      sessionStorage.setItem('noek_open_panel', payload)
    } catch (e) {}

    try {
      const targetPath = `/visit/${roomId.value}`
      if (route.path === targetPath) {
        try {
          const raw = sessionStorage.getItem('noek_open_panel')
          if (raw) {
            const parsed = JSON.parse(raw)
            const age = Date.now() - Number(parsed?.ts || 0)
            if (parsed?.panel === 'candles-steps' && age >= 0 && age < 5000) {
              sessionStorage.removeItem('noek_open_panel')
              candlePanelMode.value = 'create'
              selectedCandleFromScene.value = null
              candleStep.value = 1
              activePanel.value = 'candles-steps'
              type.value = 'candle'
              submitState.value = { loading: false, error: '', success: '' }
              return
            }
          }
        } catch (e) {}
      }

      await router.push({ path: `/visit/${roomId.value}` })

      try {
        const raw = sessionStorage.getItem('noek_open_panel')
        if (raw) {
          const parsed = JSON.parse(raw)
          const age = Date.now() - Number(parsed?.ts || 0)
          if (parsed?.panel === 'candles-steps' && age >= 0 && age < 5000) {
            sessionStorage.removeItem('noek_open_panel')
            candlePanelMode.value = 'create'
            selectedCandleFromScene.value = null
            candleStep.value = 1
            activePanel.value = 'candles-steps'
            type.value = 'candle'
            submitState.value = { loading: false, error: '', success: '' }
          }
        }
      } catch (e) {}
    } catch (e) {
      // ignore navigation errors
    }
  } else if (category === 'videos') {
    if (!roomId.value) return
    try {
      const payload = JSON.stringify({ panel: 'videos-steps', ts: Date.now() })
      sessionStorage.setItem('noek_open_panel', payload)
    } catch (e) {}

    try {
      const targetPath = `/visit/${roomId.value}`
      if (route.path === targetPath) {
        try {
          const raw = sessionStorage.getItem('noek_open_panel')
          if (raw) {
            const parsed = JSON.parse(raw)
            const age = Date.now() - Number(parsed?.ts || 0)
            if (parsed?.panel === 'videos-steps' && age >= 0 && age < 5000) {
              sessionStorage.removeItem('noek_open_panel')
              closeGalleryItem()
              galleryReactionsOpen.value = false
              galleryMode.value = 'gallery'
              activePanel.value = 'videos-steps'
              videoStep.value = 1
              videoUrlInput.value = ''
              videoPreviewEmbed.value = ''
              type.value = 'video_file'
              submitState.value = { loading: false, error: '', success: '' }
              return
            }
          }
        } catch (e) {}
      }

      await router.push({ path: `/visit/${roomId.value}` })

      try {
        const raw = sessionStorage.getItem('noek_open_panel')
        if (raw) {
          const parsed = JSON.parse(raw)
          const age = Date.now() - Number(parsed?.ts || 0)
          if (parsed?.panel === 'videos-steps' && age >= 0 && age < 5000) {
            sessionStorage.removeItem('noek_open_panel')
            closeGalleryItem()
            galleryReactionsOpen.value = false
            galleryMode.value = 'gallery'
            activePanel.value = 'videos-steps'
            videoStep.value = 1
            videoUrlInput.value = ''
            videoPreviewEmbed.value = ''
            type.value = 'video_file'
            submitState.value = { loading: false, error: '', success: '' }
          }
        }
      } catch (e) {}
    } catch (e) {
      // ignore navigation errors
    }
  } else {
    openContributionPanel(category)
  }
}

function isImageUrl(url) {
  return /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i.test(String(url || '').trim())
}

function isVideoUrl(url) {
  return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(String(url || '').trim())
}

function isAudioUrl(url) {
  return /\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i.test(String(url || '').trim())
}

function extractYouTubeVideoId(rawUrl) {
  const input = String(rawUrl || '').trim()
  if (!input) return ''

  try {
    const url = new URL(input)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()

    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || ''

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = url.searchParams.get('v') || ''
      if (v) return v

      const parts = url.pathname.split('/').filter(Boolean)
      const embedIndex = parts.findIndex((part) => part === 'embed' || part === 'shorts')
      return embedIndex >= 0 ? (parts[embedIndex + 1] || '') : ''
    }
  } catch {
    return ''
  }

  return ''
}

function getYouTubeEmbedUrl(rawUrl) {
  const id = extractYouTubeVideoId(rawUrl)
  return id ? `https://www.youtube.com/embed/${id}` : ''
}

function getSpotifyEmbedUrl(rawUrl) {
  const input = String(rawUrl || '').trim()
  if (!input) return ''

  try {
    const url = new URL(input)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    if (host !== 'open.spotify.com') return ''

    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) return `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`
  } catch {
    return ''
  }

  return ''
}

function resolveMusicPlatform(rawUrl) {
  const input = String(rawUrl || '').trim()
  if (!input) return 'none'
  if (getSpotifyEmbedUrl(input)) return 'spotify'
  if (getYouTubeEmbedUrl(input)) return 'youtube'
  return 'none'
}

function openContributionPanel(panel) {
  // Use step flows for music and photos
  if (panel === 'music') {
    activePanel.value = 'music-steps'
    musicStep.value = 1
    musicUrlInput.value = ''
    musicPreviewEmbed.value = ''
  } else if (panel === 'candles') {
    activePanel.value = 'candles-steps'
    candleStep.value = 1
    candlePanelMode.value = 'create'
    selectedCandleFromScene.value = null
    type.value = 'candle'
  } else {
    activePanel.value = panel
  }
  submitState.value = { loading: false, error: '', success: '' }

  const map = {
    photos: 'photo',
    music: 'music_url',
    videos: 'video_file',
    candles: 'candle'
  }
  if (map[panel]) type.value = map[panel]
}

function closePanel() {
  activePanel.value = 'none'
  candlePanelMode.value = 'create'
  selectedCandleFromScene.value = null
  candleStep.value = 1
}

function stopRoomAudio() {
  if (!audioPlayer.value) return
  audioPlayer.value.pause()
  audioPlayer.value.src = ''
  roomMusicState.value = { loading: false, error: '', playing: false }
}

async function startRoomAudioFromRoom(roomValue) {
  const musicUrl = String(roomValue?.ambience?.musicUrl || '').trim()
  if (!musicUrl) {
    stopRoomAudio()
    return
  }

  if (!audioPlayer.value) {
    audioPlayer.value = new Audio()
    audioPlayer.value.loop = true
  }

  audioPlayer.value.src = musicUrl
  audioPlayer.value.volume = Math.min(1, Math.max(0, Number(roomValue?.ambience?.volume ?? 0.35)))
  audioPlayer.value.muted = true
  roomMusicState.value = { loading: true, error: '', playing: false }

  try {
    await audioPlayer.value.play()
    audioPlayer.value.muted = false
    roomMusicState.value = { loading: false, error: '', playing: true }
  } catch {
    audioPlayer.value.muted = false
    roomMusicState.value = {
      loading: false,
      error: 'Geluid kon niet automatisch starten. Klik op afspelen.',
      playing: false
    }
  }
}

async function enableRoomSound() {
  await startRoomAudioFromRoom(room.value)
}

async function loadAll() {
  loading.value = true
  error.value = ''

  try {
    const [roomData, items] = await Promise.all([
      getPublicRoom(roomId.value),
      getPublicRoomContributions(roomId.value)
    ])
    room.value = roomData
    applyRoomBranding(roomData)
    contributions.value = Array.isArray(items) ? items : []
    return contributions.value
  } catch (err) {
    error.value = err?.response?.data?.error || 'Kon kamer niet laden.'
    return contributions.value
  } finally {
    loading.value = false
  }
}

async function enterRoom() {
  introLoading.value = true
  hasEnteredRoom.value = true
  persistEntryState(roomId.value)

  try {
    await startRoomAudioFromRoom(room.value)
    await loadAll()
  } finally {
    introLoading.value = false
  }
}

async function openLogin() {
  await router.push({ path: '/login', query: { next: route.path } })
}

async function openProfile() {
  if (!isLoggedIn.value) {
    profileHint.value = 'Inloggen is optioneel, maar nodig om je bijdragen in profiel te zien.'
    return
  }
  await router.push('/profile')
}

function onMediaFileChange(event) {
  const file = event?.target?.files?.[0] || null
  if (file) {
    mediaFile.value = file
    try { if (mediaPreviewUrl.value) URL.revokeObjectURL(mediaPreviewUrl.value) } catch (e) {}
    mediaPreviewUrl.value = URL.createObjectURL(file)
  } else {
    mediaFile.value = null
    try { if (mediaPreviewUrl.value) URL.revokeObjectURL(mediaPreviewUrl.value) } catch (e) {}
    mediaPreviewUrl.value = ''
  }
}

function openUploadPicker() {
  const el = document.querySelector('#photos-steps-file-input')
  if (el) el.click()
}

function removeMediaFile() {
  mediaFile.value = null
  try { if (mediaPreviewUrl.value) URL.revokeObjectURL(mediaPreviewUrl.value) } catch (e) {}
  mediaPreviewUrl.value = ''
}

function openMusicPreview() {
  const url = String(musicUrlInput.value || '').trim()
  if (!url) return
  externalUrl.value = url
  const spotify = getSpotifyEmbedUrl(url)
  const you = getYouTubeEmbedUrl(url)
  if (spotify) {
    musicPreviewEmbed.value = spotify
  } else if (you) {
    musicPreviewEmbed.value = you
  } else {
    musicPreviewEmbed.value = ''
  }
  musicStep.value = 2
}

function clearMusicPreview() {
  musicUrlInput.value = ''
  externalUrl.value = ''
  musicPreviewEmbed.value = ''
  musicStep.value = 1
}

async function postMusicAndClose() {
  type.value = 'music_url'
  externalUrl.value = String(musicUrlInput.value || externalUrl.value || '').trim()
  await addContribution()
  if (submitState.value.success) {
    musicStep.value = 1
    clearMusicPreview()
    closePanel()
  }
}

async function postCandleAndContinue() {
  type.value = 'candle'
  await addContribution()
  if (submitState.value.success) {
    candlePanelMode.value = 'create'
    selectedCandleFromScene.value = null
    candleStep.value = 2
  }
}

function showCandleComposer() {
  candlePanelMode.value = 'create'
  selectedCandleFromScene.value = null
  candleStep.value = 1
  type.value = 'candle'
  submitState.value = { loading: false, error: '', success: '' }
}

function onSceneContributionCandleSelected(payload) {
  if (!payload?.contributionId) return

  const match = candleContributions.value.find((item) => String(item?._id || '') === String(payload.contributionId)) || null
  selectedCandleFromScene.value = match
    ? {
        contributionId: String(match._id || ''),
        giverName: String(match.giverName || '').trim(),
        tributeText: String(match.tributeText || '').trim(),
        createdAt: match.createdAt || '',
        reactions: {
          heartCount: Number(match?.reactions?.heartCount || 0),
          supportCount: Number(match?.reactions?.supportCount || 0),
          candleCount: Number(match?.reactions?.candleCount || 0)
        },
        commentCount: Array.isArray(match?.comments) ? match.comments.length : 0
      }
    : {
        contributionId: String(payload.contributionId || ''),
        giverName: String(payload.giverName || '').trim(),
        tributeText: String(payload.tributeText || '').trim(),
        createdAt: '',
        reactions: {
          heartCount: 0,
          supportCount: 0,
          candleCount: 0
        },
        commentCount: 0
      }

  candlePanelMode.value = 'details'
  candleStep.value = 1
  activePanel.value = 'candles-steps'
  type.value = 'candle'
  submitState.value = { loading: false, error: '', success: '' }
}

function handlePanelBack() {
  if (activePanel.value === 'candles-steps') {
    closePanel()
    return
  }

  if (activePanel.value === 'photos-steps' && photosStep.value > 1) {
    photosStep.value = Math.max(1, photosStep.value - 1)
    return
  }
  if (activePanel.value === 'music-steps' && musicStep.value > 1) {
    musicStep.value = Math.max(1, musicStep.value - 1)
    return
  }
  if (activePanel.value === 'videos-steps' && videoStep.value > 1) {
    videoStep.value = Math.max(1, videoStep.value - 1)
    return
  }
  closePanel()
}

function openVideoUploadPicker() {
  const el = document.querySelector('#videos-steps-file-input')
  if (el) el.click()
}

function openVideoPreview() {
  const url = String(videoUrlInput.value || '').trim()
  if (!url && !mediaFile.value) return
  if (url) externalUrl.value = url
  const you = getYouTubeEmbedUrl(url)
  if (you) {
    videoPreviewEmbed.value = you
  } else {
    videoPreviewEmbed.value = ''
  }
  videoStep.value = 2
}

function clearVideoPreview() {
  videoUrlInput.value = ''
  externalUrl.value = ''
  videoPreviewEmbed.value = ''
  videoStep.value = 1
}

async function postVideoAndClose() {
  // if a file is present, post as video_file, otherwise as video_url
  if (mediaFile.value) {
    type.value = 'video_file'
  } else {
    type.value = 'video_url'
    externalUrl.value = String(videoUrlInput.value || externalUrl.value || '').trim()
  }
  await addContribution()
  if (submitState.value.success) {
    videoStep.value = 1
    clearVideoPreview()
    closePanel()
  }
}

function nextPhotosStep() {
  if (!mediaFile.value) {
    // prompt file picker if no file selected
    openUploadPicker()
    return
  }
  if (photosStep.value < 3) photosStep.value += 1
}

async function postPhotoAndClose() {
  type.value = 'photo'
  await addContribution()
  if (submitState.value.success) {
    photosStep.value = 1
    closePanel()
  }
}

async function uploadToCloudinary(file, resourceType) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || ''
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || ''

  if (!cloudName || !uploadPreset) throw new Error('Cloudinary configuratie ontbreekt.')

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: formData
  })

  if (!response.ok) throw new Error('Upload naar Cloudinary mislukt.')
  return response.json()
}

async function addContribution() {
  submitState.value = { loading: true, error: '', success: '' }

  try {
    applyVisitorName()

    let nextMediaUrl = mediaUrl.value
    if ((type.value === 'photo' || type.value === 'video_file') && mediaFile.value) {
      const uploadResult = await uploadToCloudinary(mediaFile.value, type.value === 'photo' ? 'image' : 'video')
      nextMediaUrl = uploadResult.secure_url || ''
    }

    const createdContribution = await createPublicRoomContribution(roomId.value, {
      type: type.value,
      giverName: visitorName.value,
      tributeText: tributeText.value,
      externalUrl: externalUrl.value,
      mediaUrl: nextMediaUrl,
      platform: type.value === 'music_url' ? resolveMusicPlatform(externalUrl.value) : 'none'
    })

    tributeText.value = ''
    externalUrl.value = ''
    mediaUrl.value = ''
    mediaFile.value = null
    submitState.value = { loading: false, error: '', success: 'Bijdrage toegevoegd.' }

    const freshList = await loadAll()
    if (createdContribution && createdContribution._id) {
      contributions.value = upsertContributionList(freshList, createdContribution)
    }
  } catch (err) {
    submitState.value = {
      loading: false,
      error: err?.response?.data?.error || 'Bijdrage opslaan mislukt.',
      success: ''
    }
  }
}

async function postRoomComment() {
  if (!roomCommentText.value.trim()) return

  try {
    applyVisitorName()
    room.value = await addPublicRoomComment(roomId.value, {
      text: roomCommentText.value,
      displayName: visitorName.value
    })
    roomCommentText.value = ''
    await nextTick()
    try { if (roomCommentInput.value) { roomCommentInput.value.style.height = 'auto' } } catch (e) {}
  } catch {
    // noop
  }
}

function autosizeRoomComment() {
  try {
    const el = roomCommentInput.value
    if (!el) return
    el.style.height = 'auto'
    // add small extra to avoid scrollbar in some browsers
    el.style.height = (el.scrollHeight + 2) + 'px'
  } catch (e) {}
}

async function toggleRoomReaction(kind) {
  try {
    room.value = await reactToPublicRoom(roomId.value, kind)
  } catch {
    // noop
  }
}

async function toggleContributionReaction(contributionId, kind) {
  try {
    const updated = await reactToPublicRoomContribution(roomId.value, contributionId, kind)
    contributions.value = contributions.value.map((row) => (row._id === updated._id ? updated : row))
  } catch {
    // noop
  }
}

async function submitContributionComment(contributionId) {
  const text = String(commentDrafts.value[contributionId] || '').trim()
  if (!text) return

  commentStateByItem.value = {
    ...commentStateByItem.value,
    [contributionId]: { loading: true, error: '' }
  }

  try {
    const updated = await addPublicRoomContributionComment(roomId.value, contributionId, {
      text,
      displayName: visitorName.value
    })

    contributions.value = contributions.value.map((row) => (row._id === updated._id ? updated : row))
    commentDrafts.value = {
      ...commentDrafts.value,
      [contributionId]: ''
    }
    commentStateByItem.value = {
      ...commentStateByItem.value,
      [contributionId]: { loading: false, error: '' }
    }
  } catch (err) {
    commentStateByItem.value = {
      ...commentStateByItem.value,
      [contributionId]: {
        loading: false,
        error: err?.response?.data?.error || 'Commentaar plaatsen mislukt.'
      }
    }
  }
}

onMounted(async () => {
  ensureVisitorBootState()

  if (hasEnteredRoom.value) {
    await loadAll()
    await startRoomAudioFromRoom(room.value)
  } else {
    try {
      room.value = await getPublicRoom(roomId.value)
      applyRoomBranding(room.value)
    } catch {
      error.value = 'Kon kamer niet laden.'
    }
  }

    // If sessionStorage included a recent request to open the step panel, open it now
    try {
      const raw = sessionStorage.getItem('noek_open_panel')
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          const age = Date.now() - Number(parsed?.ts || 0)
          if ((parsed?.panel === 'photos-steps' || parsed?.panel === 'music-steps' || parsed?.panel === 'videos-steps' || parsed?.panel === 'candles-steps') && age >= 0 && age < 5000) {
            sessionStorage.removeItem('noek_open_panel')
            setTimeout(() => {
              activePanel.value = parsed.panel
            }, 80)
          }
        } catch (e) {
          // malformed value, remove
          try { sessionStorage.removeItem('noek_open_panel') } catch (e) {}
        }
      }
    } catch (e) {}

    // Also support opening via query param as a fallback
    try {
      const openFlag = String(route.query?.open || '')
      if (openFlag === 'photos-steps' || openFlag === 'music-steps' || openFlag === 'videos-steps' || openFlag === 'candles-steps') {
        setTimeout(() => {
          activePanel.value = openFlag
        }, 80)
        const q = { ...route.query }
        delete q.open
        router.replace({ path: route.path, query: q }).catch(() => {})
      }
    } catch (e) {}

    // remember last visited room path so profile can link back
    try {
      if (typeof window !== 'undefined' && route.path && route.path.startsWith('/visit/')) {
        sessionStorage.setItem('noek_last_room', route.path)
      }
    } catch (e) {}
    // also append to a local visited rooms list (keep recent history)
    try {
      if (typeof window !== 'undefined' && roomId.value) {
        const key = 'noek_visited_rooms'
        const raw = window.localStorage.getItem(key) || '[]'
        let list = []
        try { list = JSON.parse(raw) } catch (e) { list = [] }
        const path = route.path
        const roomNameLocal = String(room?.name || roomTitle.value || '').trim()
        // remove existing with same path
        list = (list || []).filter((r) => r.path !== path)
        list.unshift({ path, roomId: roomId.value, name: roomNameLocal, ts: Date.now() })
        // keep up to 20
        list = list.slice(0, 20)
        try { window.localStorage.setItem(key, JSON.stringify(list)) } catch (e) {}
      }
    } catch (e) {}
})

watch(() => route.query.open, (openFlag) => {
  const value = String(openFlag || '')
  if (value === 'photos-steps' || value === 'music-steps' || value === 'videos-steps' || value === 'candles-steps') {
    const panel = value
    setTimeout(() => {
      activePanel.value = panel
    }, 0)
    const q = { ...route.query }
    delete q.open
    router.replace({ path: route.path, query: q }).catch(() => {})
  }
})

watch(activePanel, (val) => {
  if (val === 'photos-steps') {
    photosStep.value = 1
    type.value = 'photo'
  } else if (val === 'music-steps') {
    musicStep.value = 1
    type.value = 'music_url'
  } else if (val === 'videos-steps') {
    videoStep.value = 1
    type.value = 'video_file'
  } else if (val === 'candles-steps') {
    candleStep.value = 1
    type.value = 'candle'
  }
})

watch(roomId, () => {
  hasEnteredRoom.value = readStoredEntryState(roomId.value)
  try {
    const raw = sessionStorage.getItem('noek_open_panel')
    let keep = false
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        const age = Date.now() - Number(parsed?.ts || 0)
        if ((parsed?.panel === 'photos-steps' || parsed?.panel === 'music-steps' || parsed?.panel === 'videos-steps' || parsed?.panel === 'candles-steps') && age >= 0 && age < 5000) keep = true
      } catch (e) {}
    }
    // Only auto-close if the currently open panel is one of the multi-step panels.
    if (!keep && ['photos-steps', 'music-steps', 'videos-steps', 'candles-steps'].includes(activePanel.value)) activePanel.value = 'none'
  } catch (e) {
    if (['photos-steps', 'music-steps', 'videos-steps', 'candles-steps'].includes(activePanel.value)) activePanel.value = 'none'
  }
})

watch(selectedCategory, () => {
  try {
    const raw = sessionStorage.getItem('noek_open_panel')
    let keep = false
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        const age = Date.now() - Number(parsed?.ts || 0)
        if ((parsed?.panel === 'photos-steps' || parsed?.panel === 'music-steps' || parsed?.panel === 'videos-steps' || parsed?.panel === 'candles-steps') && age >= 0 && age < 5000) keep = true
      } catch (e) {}
    }
    // Only auto-close step panels; leave other panels (messages, candles, etc.) alone.
    if (!keep && ['photos-steps', 'music-steps', 'videos-steps', 'candles-steps'].includes(activePanel.value)) activePanel.value = 'none'
  } catch (e) {
    if (['photos-steps', 'music-steps', 'videos-steps', 'candles-steps'].includes(activePanel.value)) activePanel.value = 'none'
  }
  galleryMode.value = 'gallery'
  galleryPage.value = 0
  gallerySelectedId.value = ''
  roomMode.value = 'room'
})

watch(filteredContributions, () => {
  if (galleryPage.value > galleryPageCount.value - 1) {
    galleryPage.value = Math.max(0, galleryPageCount.value - 1)
  }

  if (!filteredContributions.value.length) {
    gallerySelectedId.value = ''
    return
  }

  if (gallerySelectedIndex.value < 0 && gallerySelectedId.value) {
    gallerySelectedId.value = ''
  }
})

watch(candleContributions, () => {
  const selectedId = String(selectedCandleFromScene.value?.contributionId || '').trim()
  if (!selectedId) return

  const current = candleContributions.value.find((item) => String(item?._id || '') === selectedId)
  if (!current) return

  selectedCandleFromScene.value = {
    contributionId: String(current._id || ''),
    giverName: String(current.giverName || '').trim(),
    tributeText: String(current.tributeText || '').trim(),
    createdAt: current.createdAt || '',
    reactions: {
      heartCount: Number(current?.reactions?.heartCount || 0),
      supportCount: Number(current?.reactions?.supportCount || 0),
      candleCount: Number(current?.reactions?.candleCount || 0)
    },
    commentCount: Array.isArray(current?.comments) ? current.comments.length : 0
  }
}, { deep: true })

onBeforeUnmount(() => {
  stopRoomAudio()
})
</script>

<template>
  <div class="visitor-page-v3">
    <div v-if="!hasEnteredRoom" class="visitor-entry-wrap">
      <div class="visitor-entry-card">
        <div class="visitor-entry-hero">
          <div class="visitor-entry-logo">
            <img :src="entryLogoSrc" alt="Brand logo" class="visitor-entry-logo-image" />
          </div>

          

          <div class="visitor-entry-candle-scene" aria-hidden="true">
            <div class="visitor-entry-candle is-large">
              <span class="visitor-entry-candle-flame"></span>
              <span class="visitor-entry-candle-wax"></span>
            </div>
            <div class="visitor-entry-candle is-small">
              <span class="visitor-entry-candle-flame"></span>
              <span class="visitor-entry-candle-wax"></span>
            </div>
          </div>

          <p class="visitor-entry-copy">
            Je betreedt <strong>{{ roomTitle }}</strong>.<br>
            Waar herinneringen blijven voortleven.
          </p>

          <button type="button" class="visitor-entry-button" :disabled="introLoading" @click="enterRoom">
            {{ introLoading ? 'Herinneringen worden geladen...' : 'Stap binnen' }}
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="isGalleryPage" class="visitor-gallery-shell" :class="{ 'vr-mode-active': isVrMode }">
      <header v-if="!isVrMode" class="visitor-gallery-topbar">
        <div class="visitor-title-card">
          <h1>{{ roomTitle }}</h1>
        </div>

        <div class="visitor-topbar-right">
          <div>
            <template v-if="isLoggedIn">
              <button type="button" class="visitor-name-btn" @click="openProfile">
                <span>{{ authDisplayName || visitorName || 'Naam' }}</span>
                <span class="visitor-edit">✎</span>
              </button>
            </template>
            <template v-else>
              <template v-if="editingVisitorName">
                <input ref="nameInput" class="visitor-name-input" v-model="visitorName" @blur="finishEditVisitorName" @keydown.enter.prevent="finishEditVisitorName" />
              </template>
              <template v-else>
                <button type="button" class="visitor-name-btn" @click="startEditVisitorName">
                  <span>{{ visitorName || 'Naam' }}</span>
                  <span class="visitor-edit">✎</span>
                </button>
              </template>
            </template>
          </div>
          <button type="button" class="visitor-user-btn" @click="isLoggedIn ? openProfile() : openLogin()">
            {{ isLoggedIn ? 'Profiel' : 'Inloggen' }}
          </button>
        </div>
      </header>

      <main class="visitor-gallery-main" :class="{ 'is-vr': isVrMode }">
        <section v-if="!isVrMode" class="visitor-gallery-frame">
          <button type="button" class="visitor-back-btn visitor-back-btn-gallery" @click="goToOverview">← Terug</button>

          <div class="visitor-gallery-candle left" aria-hidden="true">
            <div class="visitor-entry-candle is-large">
              <span class="visitor-entry-candle-flame"></span>
              <span class="visitor-entry-candle-wax"></span>
            </div>
            <div class="visitor-entry-candle is-small">
              <span class="visitor-entry-candle-flame"></span>
              <span class="visitor-entry-candle-wax"></span>
            </div>
          </div>

          <div class="visitor-gallery-panel">
            <div class="visitor-gallery-heading">
              <div>
                <p class="visitor-gallery-kicker">{{ galleryCategoryLabel }}</p>
                <h2>{{ galleryHeading }}</h2>
              </div>
            </div>

            <div v-if="loading" class="visitor-status">Kamer laden...</div>
            <div v-else-if="error" class="visitor-status error">{{ error }}</div>
            <template v-else>
              <div v-if="filteredContributions.length" class="visitor-gallery-grid" :class="{ 'is-media': selectedCategory !== 'photos' }">
                <article
                  v-for="(item, index) in pagedContributions"
                  :key="item._id || index"
                  class="visitor-gallery-card"
                  :class="selectedCategory === 'photos' ? `tile-${(index % 7) + 1}` : 'visitor-gallery-media-card'"
                  @click="openGalleryItem(item)"
                >
                  <div class="visitor-gallery-media">
                    <img
                      v-if="item.type === 'photo' || isImageUrl(item.mediaUrl)"
                      :src="item.mediaUrl"
                      :alt="item.giverName || 'Foto'"
                      class="visitor-gallery-image"
                    >
                    <video
                      v-else-if="item.type === 'video_file' || isVideoUrl(item.mediaUrl)"
                      :src="item.mediaUrl"
                      controls
                      class="visitor-gallery-video"
                    />
                    <iframe
                      v-else-if="getYouTubeEmbedUrl(item.externalUrl)"
                      class="visitor-gallery-embed"
                      :src="getYouTubeEmbedUrl(item.externalUrl)"
                      title="YouTube"
                    />
                    <iframe
                      v-else-if="getSpotifyEmbedUrl(item.externalUrl)"
                      class="visitor-gallery-embed"
                      :src="getSpotifyEmbedUrl(item.externalUrl)"
                      title="Spotify"
                    />
                    <audio
                      v-else-if="isAudioUrl(item.externalUrl)"
                      :src="item.externalUrl"
                      controls
                      class="visitor-gallery-audio"
                    />
                    <div v-else class="visitor-gallery-placeholder">
                      <strong>{{ item.giverName || 'Bezoeker' }}</strong>
                      <span>Geen preview beschikbaar</span>
                    </div>
                  </div>

                  <div v-if="selectedCategory !== 'photos'" class="visitor-gallery-copy">
                    <strong>{{ item.giverName || 'Bezoeker' }}</strong>
                    <p>{{ item.tributeText || ' ' }}</p>
                  </div>
                </article>
              </div>
              <p v-else class="visitor-gallery-empty">Nog geen bijdragen in deze categorie.</p>
            </template>

            <div v-if="gallerySelectedItem" class="visitor-gallery-lightbox" @click.self="closeGalleryItem">
              <div class="visitor-gallery-lightbox-card">
                <button type="button" class="visitor-gallery-lightbox-close" @click="closeGalleryItem">×</button>

                <aside class="visitor-gallery-lightbox-info">
                  <h3>{{ galleryCategoryLabel.toLowerCase() }} van {{ gallerySelectedItem.giverName || 'naam' }}</h3>
                  <p class="visitor-gallery-lightbox-label">Hun boodschap:</p>
                  <div class="visitor-gallery-lightbox-message">{{ gallerySelectedItem.tributeText || 'Geen boodschap toegevoegd.' }}</div>

                  <div class="visitor-gallery-lightbox-reactions-wrap">
                    <div class="visitor-gallery-lightbox-reactions">
                              <div class="visitor-gallery-reaction-toggle">
                                  <button type="button" class="visitor-gallery-reaction-btn" @click="toggleContributionReaction(gallerySelectedItem._id, 'heart')">❤ <span class="reaction-count">{{ gallerySelectedItem.reactions?.heartCount || 0 }}</span></button>
                                  <button type="button" class="visitor-gallery-reaction-btn" @click="toggleContributionReaction(gallerySelectedItem._id, 'support')">🤝 <span class="reaction-count">{{ gallerySelectedItem.reactions?.supportCount || 0 }}</span></button>
                                  <button type="button" class="visitor-gallery-reaction-btn" @click="toggleContributionReaction(gallerySelectedItem._id, 'candle')">🕯 <span class="reaction-count">{{ gallerySelectedItem.reactions?.candleCount || 0 }}</span></button>
                                </div>

                      <button
                        type="button"
                        class="visitor-gallery-comment-toggle"
                        :aria-expanded="galleryReactionsOpen"
                        aria-label="Toon reacties"
                        @click="toggleGalleryReactions"
                      >
                        <span class="visitor-gallery-comment-icon" aria-hidden="true"></span>
                      </button>
                    </div>

                    <div v-if="galleryReactionsOpen" class="visitor-gallery-reaction-panel">
                      <button type="button" class="visitor-gallery-reaction-close" @click="toggleGalleryReactions">×</button>
                      <ul class="item-comments-items visitor-gallery-comments" v-if="gallerySelectedItem.comments?.length">
                        <li v-for="comment in gallerySelectedItem.comments" :key="comment._id || comment.createdAt" class="item-comment-entry visitor-gallery-comment-entry">
                          <div class="visitor-gallery-comment-author-row">
                            <span class="visitor-gallery-comment-avatar" aria-hidden="true"></span>
                            <span class="item-comment-author">{{ comment.displayName || 'Bezoeker' }}</span>
                          </div>
                          <div class="visitor-gallery-comment-bubble">{{ comment.text }}</div>
                        </li>
                      </ul>

                      <form class="visitor-gallery-comment-form" @submit.prevent="submitContributionComment(gallerySelectedItem._id)">
                        <input v-model="commentDrafts[gallerySelectedItem._id]" type="text" maxlength="500" placeholder="Type hier je bericht" />
                        <button type="submit" :disabled="commentStateByItem[gallerySelectedItem._id]?.loading">{{ commentStateByItem[gallerySelectedItem._id]?.loading ? 'Bezig...' : 'Plaats' }}</button>
                      </form>
                    </div>
                  </div>
                </aside>

                <div class="visitor-gallery-lightbox-media">
                  <img
                    v-if="gallerySelectedItem.type === 'photo' || isImageUrl(gallerySelectedItem.mediaUrl)"
                    :src="gallerySelectedItem.mediaUrl"
                    :alt="gallerySelectedItem.giverName || 'Foto'"
                    class="visitor-gallery-lightbox-image"
                  >
                  <video
                    v-else-if="gallerySelectedItem.type === 'video_file' || isVideoUrl(gallerySelectedItem.mediaUrl)"
                    :src="gallerySelectedItem.mediaUrl"
                    controls
                    class="visitor-gallery-lightbox-video visitor-gallery-lightbox-video--force"
                  />
                  <iframe
                    v-else-if="getYouTubeEmbedUrl(gallerySelectedItem.externalUrl)"
                    class="visitor-gallery-lightbox-embed"
                    :src="getYouTubeEmbedUrl(gallerySelectedItem.externalUrl)"
                    title="YouTube"
                  />
                  <iframe
                    v-else-if="getSpotifyEmbedUrl(gallerySelectedItem.externalUrl)"
                    class="visitor-gallery-lightbox-embed"
                    :src="getSpotifyEmbedUrl(gallerySelectedItem.externalUrl)"
                    title="Spotify"
                  />
                  <audio
                    v-else-if="isAudioUrl(gallerySelectedItem.externalUrl)"
                    :src="gallerySelectedItem.externalUrl"
                    controls
                    class="visitor-gallery-lightbox-audio"
                  />
                  <div v-else class="visitor-gallery-placeholder">
                    <strong>{{ gallerySelectedItem.giverName || 'Bezoeker' }}</strong>
                    <span>Geen preview beschikbaar</span>
                  </div>

                  <button type="button" class="visitor-gallery-lightbox-next" @click="goToNextGalleryItem">›</button>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            class="visitor-gallery-next"
            :disabled="!hasMultipleGalleryPages"
            aria-label="Volgende items"
            @click="goToNextGalleryPage"
          >
            ▶
          </button>

          <div class="visitor-gallery-candle right" aria-hidden="true">
            <div class="visitor-entry-candle is-small">
              <span class="visitor-entry-candle-flame"></span>
              <span class="visitor-entry-candle-wax"></span>
            </div>
          </div>
        </section>

        <VR3DScene
          v-else
          :items="vrGalleryItems"
          :room-data="roomSceneData"
          @exit="exitVrMode"
        />

        <button v-if="showVrToggle && !isVrMode" type="button" class="visitor-vr-entry-btn" @click="enterVrMode">
          VR
        </button>
      </main>

      <!-- Room reactions sidebar -->
      <aside v-if="roomReactionsOpen" class="visitor-room-reaction-panel" @click.self="toggleRoomReactions">
        <button type="button" class="visitor-gallery-reaction-close" @click="toggleRoomReactions">×</button>
        <div class="visitor-gallery-comments-list">
          <template v-if="filteredContributions.length">
            <ul class="item-comments-items visitor-gallery-comments">
              <li v-for="item in filteredContributions" :key="item._id" class="item-comment-entry visitor-gallery-comment-entry">
                <div class="visitor-gallery-comment-author-row">
                  <span class="visitor-gallery-comment-avatar" aria-hidden="true"></span>
                  <span class="item-comment-author">{{ item.giverName || 'Bezoeker' }}</span>
                </div>
                <div class="visitor-gallery-comment-bubble small">Bijdrage: {{ item.tributeText || '-' }}</div>

                <div class="visitor-gallery-comment-sublist" v-if="item.comments?.length">
                  <ul>
                    <li v-for="c in item.comments" :key="c._id || c.createdAt" class="item-comment-entry visitor-gallery-comment-entry">
                      <div class="visitor-gallery-comment-author-row">
                        <span class="visitor-gallery-comment-avatar" aria-hidden="true"></span>
                        <span class="item-comment-author">{{ c.displayName || 'Bezoeker' }}</span>
                      </div>
                      <div class="visitor-gallery-comment-bubble">{{ c.text }}</div>
                    </li>
                  </ul>
                </div>

                <form class="visitor-gallery-comment-form" @submit.prevent="submitContributionComment(item._id)">
                  <input v-model="commentDrafts[item._id]" type="text" maxlength="500" placeholder="Type hier je bericht" />
                  <button type="submit" :disabled="commentStateByItem[item._id]?.loading">{{ commentStateByItem[item._id]?.loading ? 'Bezig...' : 'Plaats' }}</button>
                </form>
              </li>
            </ul>
          </template>
          <p v-else class="visitor-status">Nog geen reacties.</p>
        </div>
      </aside>

      <footer v-if="!isVrMode" class="visitor-gallery-footer">
        <button type="button" class="visitor-gallery-add" @click="openGalleryComposer(selectedCategory)">
          {{ galleryActionLabel }}
        </button>

        <div class="visitor-action-bar visitor-gallery-tabs">
          <button type="button" :class="['visitor-action-btn', { active: selectedCategory === 'photos' }]" @click="goToGallery('photos')">
            <div class="visitor-action-icon">
              <div class="icon-shape icon-foto"></div>
            </div>
            <span class="visitor-action-label">Foto's</span>
          </button>
          <button type="button" :class="['visitor-action-btn', { active: selectedCategory === 'music' }]" @click="goToGallery('music')">
            <div class="visitor-action-icon">
              <div class="icon-shape icon-muziek"></div>
            </div>
            <span class="visitor-action-label">Muziek</span>
          </button>
          
          <button type="button" :class="['visitor-action-btn', { active: selectedCategory === 'videos' }]" @click="goToGallery('videos')">
            <div class="visitor-action-icon">
              <div class="icon-shape icon-video"></div>
            </div>
            <span class="visitor-action-label">Video's</span>
          </button>
          <button type="button" :class="['visitor-action-btn', { active: activePanel === 'candles-steps' }]" @click="openGalleryComposer('candles')">
            <div class="visitor-action-icon">
              <div class="icon-shape icon-kaars"></div>
            </div>
            <span class="visitor-action-label">Kaarsjes</span>
          </button>
          <button type="button" :class="['visitor-action-btn', { active: activePanel === 'messages' }]" @click="openContributionPanel('messages')">
            <div class="visitor-action-icon">
              <div class="icon-shape icon-message"></div>
            </div>
            <span class="visitor-action-label">Bericht</span>
          </button>
        </div>

        <div class="visitor-brand-card">
          <img v-if="brandLogoUrl" :src="brandLogoUrl" alt="Brand logo" class="visitor-brand-logo" />
          <strong>{{ logoTitle }}</strong>
          <span>{{ logoSubtitle }}</span>
        </div>
      </footer>


    </div>

    <div v-else class="visitor-shell">
      <header class="visitor-topbar">
        <h1>{{ roomTitle }}</h1>
        <div class="visitor-topbar-right">
          <div>
            <template v-if="isLoggedIn">
              <button type="button" class="visitor-name-btn" @click="openProfile">
                <span>{{ authDisplayName || visitorName || 'Naam' }}</span>
                <span class="visitor-edit">✎</span>
              </button>
            </template>
            <template v-else>
              <template v-if="editingVisitorName">
                <input ref="nameInput" class="visitor-name-input" v-model="visitorName" @blur="finishEditVisitorName" @keydown.enter.prevent="finishEditVisitorName" />
              </template>
              <template v-else>
                <button type="button" class="visitor-name-btn" @click="startEditVisitorName">
                  <span>{{ visitorName || 'Naam' }}</span>
                  <span class="visitor-edit">✎</span>
                </button>
              </template>
            </template>
          </div>
          <button type="button" class="visitor-user-btn" @click="isLoggedIn ? openProfile() : openLogin()">
            {{ isLoggedIn ? 'Profiel' : 'Inloggen' }}
          </button>
        </div>
      </header>

      <main class="visitor-stage">
        <div v-if="!loading && !error && room" class="visitor-scene-frame">
          <ThreeScene
            class="visitor-scene"
            :room-data="roomSceneData"
            :room-contributions="candleContributions"
            @contribution-candle-selected="onSceneContributionCandleSelected"
          />
        </div>
        <div v-else-if="loading" class="visitor-status">Kamer laden...</div>
        <div v-else class="visitor-status error">{{ error }}</div>
      </main>

      <footer class="visitor-footer">
        <button type="button" class="visitor-pill-btn" @click="openContributionPanel('tutorial')">Tutorial volgen</button>

        <div class="visitor-action-bar">
          <button type="button" :class="['visitor-action-btn', { active: selectedCategory === 'photos' }]" @click="goToGallery('photos')">
            <div class="visitor-action-icon">
              <div class="icon-shape icon-foto"></div>
            </div>
            <span class="visitor-action-label">Foto's</span>
          </button>
          <button type="button" :class="['visitor-action-btn', { active: selectedCategory === 'music' }]" @click="goToGallery('music')">
            <div class="visitor-action-icon">
              <div class="icon-shape icon-muziek"></div>
            </div>
            <span class="visitor-action-label">Muziek</span>
          </button>
          <button type="button" :class="['visitor-action-btn', { active: selectedCategory === 'videos' }]" @click="goToGallery('videos')">
            <div class="visitor-action-icon">
              <div class="icon-shape icon-video"></div>
            </div>
            <span class="visitor-action-label">Video's</span>
          </button>
          <button type="button" :class="['visitor-action-btn', { active: activePanel === 'candles-steps' }]" @click="openContributionPanel('candles')">
            <div class="visitor-action-icon">
              <div class="icon-shape icon-kaars"></div>
            </div>
            <span class="visitor-action-label">Kaarsjes</span>
          </button>
          <button type="button" :class="['visitor-action-btn', { active: activePanel === 'messages' }]" @click="openContributionPanel('messages')">
            <div class="visitor-action-icon">
              <div class="icon-shape icon-message"></div>
            </div>
            <span class="visitor-action-label">Bericht</span>
          </button>
        </div>

        <div class="visitor-brand-card">
          <img v-if="brandLogoUrl" :src="brandLogoUrl" alt="Brand logo" class="visitor-brand-logo" />
        </div>
      </footer>

      <section v-if="activePanel !== 'none'" :class="['visitor-panel', { 'visitor-panel--side': activePanel === 'photos-steps' || activePanel === 'music-steps' || activePanel === 'videos-steps' || activePanel === 'candles-steps' || activePanel === 'messages', 'visitor-panel--side-right': activePanel === 'messages', 'visitor-panel--candle-detail': isCandleDetailsPanel }]">
        <div class="visitor-panel-head">
            <div class="panel-head-left">
            <strong v-if="isCandleDetailsPanel">{{ candleDetailsHeading }}</strong>
            <button v-else-if="activePanel === 'photos-steps' || activePanel === 'music-steps' || activePanel === 'videos-steps' || activePanel === 'candles-steps'" type="button" class="visitor-back" @click="handlePanelBack">◀ Terug</button>
            <strong v-else>{{ panelTitle }}</strong>
          </div>
          <div class="panel-head-right">
            <button v-if="isCandleDetailsPanel" type="button" class="visitor-close visitor-close-soft" @click="closePanel">×</button>
            <small v-else-if="activePanel === 'photos-steps'">Stap {{ photosStep }} van 3</small>
            <small v-else-if="activePanel === 'music-steps'">Stap {{ musicStep }} van 3</small>
            <small v-else-if="activePanel === 'videos-steps'">Stap {{ videoStep }} van 3</small>
            <small v-else-if="activePanel === 'candles-steps'">Stap {{ candleStep }} van 2</small>
            <button v-else type="button" class="visitor-close" @click="closePanel">×</button>
          </div>
        </div>

        <!-- debug overlay removed -->

        <div class="visitor-panel-body">
          <template v-if="activePanel === 'tutorial'">
            <p>1. Kies onderaan een type bijdrage.</p>
            <p>2. Voeg tekst/foto/video/muziek toe en druk op opslaan.</p>
            <p>3. Reageer met comments of reacties op bestaande bijdragen.</p>
            <hr>
            <div class="roomMusicLine">
              <button type="button" class="visitor-pill-btn" @click="enableRoomSound">Geluid afspelen</button>
              <span v-if="roomMusicState.playing">Kamergeluid speelt</span>
              <span v-else-if="roomMusicState.error">{{ roomMusicState.error }}</span>
            </div>
          </template>

          <template v-else-if="activePanel === 'music-steps'">
            <div class="steps-container">
              <div class="steps-progress">
                <div class="steps-track">
                  <span v-for="n in 3" :key="n" :class="['step-seg', { active: n <= musicStep }]"></span>
                </div>
              </div>
              <div class="steps-body">
                <div class="steps-title"><strong>Media</strong></div>
                <div class="steps-subtitle">muziek</div>
                <p class="steps-desc">Upload vanuit je playlist</p>

                <template v-if="musicStep === 1">
                  <label class="panel-field">
                    <input class="music-url-input" v-model="musicUrlInput" type="url" placeholder="Plaats video URL hier">
                  </label>
                </template>

                <template v-else-if="musicStep === 2">
                  <div class="music-preview-box">
                    <template v-if="musicPreviewEmbed">
                      <iframe :src="musicPreviewEmbed" frameborder="0" allowfullscreen style="width:100%;height:140px;border-radius:8px"></iframe>
                    </template>
                    <template v-else>
                      <div class="music-no-preview">Voorbeeld niet beschikbaar voor deze link</div>
                    </template>
                  </div>
                  <hr class="steps-sep" />
                  <label class="panel-field">
                    <span>Schrijf hier een boodschap (optioneel)</span>
                    <textarea v-model="tributeText" rows="4" maxlength="1000" placeholder=""></textarea>
                  </label>
                </template>

                <div class="panel-actions">
                  <button v-if="musicStep === 1" type="button" class="visitor-pill-btn" @click="openMusicPreview">Verder</button>
                  <button v-else-if="musicStep === 2" type="button" class="visitor-pill-btn" @click="postMusicAndClose">Posten</button>
                </div>
              </div>
            </div>
            </template>

            <template v-else-if="activePanel === 'videos-steps'">
              <div class="steps-container">
                <div class="steps-progress">
                  <div class="steps-track">
                    <span v-for="n in 3" :key="n" :class="['step-seg', { active: n <= videoStep }]" />
                  </div>
                </div>
                <div class="steps-body">
                  <div class="steps-title"><strong>Media</strong></div>
                  <div class="steps-subtitle">Video</div>
                  <p class="steps-desc">Plaats je video bestand hier of upload een video link</p>

                  <template v-if="videoStep === 1">
                    <div class="upload-meta" v-if="mediaFile">
                      <span class="upload-filename">{{ mediaFile.name }}</span>
                      <button type="button" class="upload-delete" @click="removeMediaFile">🗑️<span class="sr-only">Delete</span></button>
                    </div>
                    <div class="upload-box" role="button" tabindex="0" @click="openVideoUploadPicker">
                      <input id="videos-steps-file-input" type="file" accept="video/*" @change="onMediaFileChange" style="display:none">
                      <template v-if="!mediaPreviewUrl">
                        <svg width="120" height="80" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="1" y="3" width="22" height="12" rx="2" fill="#0A5270" opacity="0.08"/>
                          <path d="M4 10l3-3 2 2 3-4 4 6H4z" fill="#0A5270" opacity="0.18"/>
                        </svg>
                        <div class="upload-hint">Ondersteunde bestanden: MP4, WebM, MOV (max. 50mb)</div>
                      </template>
                      <template v-else>
                        <div class="upload-preview">
                          <video v-if="mediaFile && mediaFile.type && mediaFile.type.startsWith('video')" :src="mediaPreviewUrl" controls class="videos-step-preview-video"></video>
                          <img v-else :src="mediaPreviewUrl" alt="Preview" />
                        </div>
                      </template>
                    </div>

                    <hr class="steps-sep" />
                    <label class="panel-field">
                      <span>Upload hier een URL</span>
                      <input class="music-url-input" v-model="videoUrlInput" type="url" placeholder="Plaats video URL hier">
                    </label>
                  </template>

                  <template v-else-if="videoStep === 2">
                    <div class="music-preview-box">
                      <template v-if="videoPreviewEmbed">
                        <iframe :src="videoPreviewEmbed" frameborder="0" allowfullscreen style="width:100%;height:140px;border-radius:8px"></iframe>
                      </template>
                      <template v-else>
                        <div class="music-no-preview">Voorbeeld niet beschikbaar voor deze link</div>
                      </template>
                    </div>
                    <hr class="steps-sep" />
                    <label class="panel-field">
                      <span>Schrijf hier een boodschap (optioneel)</span>
                      <textarea v-model="tributeText" rows="4" maxlength="1000" placeholder=""></textarea>
                    </label>
                  </template>

                  <div class="panel-actions">
                    <button v-if="videoStep === 1" type="button" class="visitor-pill-btn" @click="openVideoPreview">Verder</button>
                    <button v-else-if="videoStep === 2" type="button" class="visitor-pill-btn" @click="postVideoAndClose">Posten</button>
                  </div>
                </div>
              </div>
          </template>

          <template v-else-if="activePanel === 'candles-steps'">
            <div class="steps-container">
              <div v-if="!(candlePanelMode === 'details' && selectedCandleFromScene)" class="steps-progress">
                <div class="steps-track">
                  <span v-for="n in 2" :key="n" :class="['step-seg', { active: n <= candleStep }]" />
                </div>
              </div>
              <div class="steps-body">
                <template v-if="!(candlePanelMode === 'details' && selectedCandleFromScene)">
                  <div class="steps-title"><strong>Brand een kaarsje</strong></div>
                  <div class="steps-subtitle">Kaarsjes</div>
                  <p class="steps-desc">Laat je steun blijken en brand een kaarsje.</p>
                </template>

                <template v-if="candlePanelMode === 'details' && selectedCandleFromScene && candleStep === 1">
                  <div class="candle-detail-frame">
                    <div class="candle-detail-icon-wrap" aria-hidden="true">
                      <span class="candle-detail-flame"></span>
                      <span class="candle-detail-body"></span>
                    </div>

                    <hr class="candle-detail-divider" />

                    <div class="candle-detail-card">
                      <p class="candle-detail-label">Hun boodschap:</p>
                      <p class="candle-detail-text">{{ selectedCandleFromScene.tributeText || 'Geen boodschap toegevoegd.' }}</p>
                    </div>

                    <div class="candle-detail-reactions" aria-label="Reacties">
                      <button type="button" class="candle-detail-reaction-chip" @click="toggleContributionReaction(selectedCandleFromScene.contributionId, 'heart')" aria-label="Hartje reactie">
                        ❤️ <span>{{ selectedCandleFromScene.reactions?.heartCount || 0 }}</span>
                      </button>
                      <button type="button" class="candle-detail-reaction-chip" @click="toggleContributionReaction(selectedCandleFromScene.contributionId, 'support')" aria-label="Steun reactie">
                        🤝 <span>{{ selectedCandleFromScene.reactions?.supportCount || 0 }}</span>
                      </button>
                      <button type="button" class="candle-detail-reaction-chip" @click="toggleContributionReaction(selectedCandleFromScene.contributionId, 'candle')" aria-label="Kaars reactie">
                        😢 <span>{{ selectedCandleFromScene.reactions?.candleCount || 0 }}</span>
                      </button>
                    </div>
                  </div>
                </template>

                <template v-else-if="candleStep === 1">
                  <div class="candle-compose-icon-wrap" aria-hidden="true">
                    <span class="candle-compose-flame"></span>
                    <span class="candle-compose-body"></span>
                  </div>

                  <hr class="candle-compose-divider" />

                  <label class="panel-field">
                    <span>Schrijf een mooie boodschap (optioneel)</span>
                    <textarea v-model="tributeText" rows="4" maxlength="1000" placeholder="Je zin nog altijd in onze gedachten"></textarea>
                  </label>
                  <div class="panel-actions">
                    <button type="button" class="visitor-pill-btn" :disabled="submitState.loading" @click="postCandleAndContinue">
                      {{ submitState.loading ? 'Plaatsen...' : 'Plaatsen' }}
                    </button>
                  </div>
                  <p v-if="submitState.error" class="visitor-status error">{{ submitState.error }}</p>
                </template>

                <template v-else>
                  <p class="visitor-status ok">Je kaarsje brandt in de herdenkingsruimte.</p>
                  <div class="panel-actions">
                    <button type="button" class="visitor-pill-btn" @click="showCandleComposer">Nog een kaarsje</button>
                    <button type="button" class="visitor-pill-btn secondary" @click="closePanel">Sluiten</button>
                  </div>
                </template>
              </div>
            </div>
          </template>

          <template v-else-if="activePanel === 'messages'">
            <div class="item-reactions-row" aria-hidden="true">
              <button type="button" class="reaction-chip" @click="toggleRoomReaction('heart')">❤</button>
              <button type="button" class="reaction-chip" @click="toggleRoomReaction('support')">🤝</button>
              <button type="button" class="reaction-chip" @click="toggleRoomReaction('candle')">🕯</button>
            </div>
            <ul class="item-comments-items visitor-gallery-comments" v-if="room?.roomComments?.length">
              <li v-for="comment in room.roomComments" :key="comment._id || comment.createdAt" class="visitor-gallery-comment-entry">
                <div class="visitor-gallery-comment-author-row">
                  <span class="visitor-gallery-comment-avatar" aria-hidden="true"></span>
                  <span class="item-comment-author">{{ comment.displayName || 'Bezoeker' }}</span>
                </div>
                <div class="visitor-gallery-comment-bubble">{{ comment.text }}</div>
              </li>
            </ul>
            <form class="item-comment-form" @submit.prevent="postRoomComment">
              <textarea v-model="roomCommentText" ref="roomCommentInput" rows="1" maxlength="500" placeholder="Type hier je bericht" @input="autosizeRoomComment"></textarea>
              <button type="submit" class="visitor-pill-btn" aria-label="Verstuur bericht">
                <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="currentColor" />
                </svg>
              </button>
            </form>
          </template>

          <template v-else-if="activePanel === 'photos-steps'">
            <div class="steps-container">
              <div class="steps-progress">
                <div class="steps-track">
                  <span v-for="n in 3" :key="n" :class="['step-seg', { active: n <= photosStep }]" />
                </div>
              </div>
              <div class="steps-body">
                <div class="steps-title"><strong>Media</strong></div>
                <div class="steps-subtitle">Foto</div>
                <p class="steps-desc">Upload hier een foto dat voor jou iets betekend.</p>

                <div v-if="mediaFile" class="upload-meta">
                  <span class="upload-filename">{{ mediaFile.name }}</span>
                  <button type="button" class="upload-delete" @click="removeMediaFile">🗑️<span class="sr-only">Delete</span></button>
                </div>
                <div class="upload-box" role="button" tabindex="0" @click="openUploadPicker">
                  <input id="photos-steps-file-input" type="file" accept="image/*" @change="onMediaFileChange" style="display:none">
                  <template v-if="!mediaPreviewUrl">
                    <svg width="120" height="80" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="1" y="3" width="22" height="12" rx="2" fill="#0A5270" opacity="0.08"/>
                      <path d="M4 10l3-3 2 2 3-4 4 6H4z" fill="#0A5270" opacity="0.18"/>
                    </svg>
                  </template>
                  <template v-else>
                    <div class="upload-preview">
                      <img :src="mediaPreviewUrl" alt="Preview" />
                    </div>
                  </template>
                </div>

                <template v-if="photosStep === 2">
                  <hr class="steps-sep" />
                  <label class="panel-field">
                    <span>Schrijf hier een boodschap (optioneel)</span>
                    <textarea v-model="tributeText" rows="4" maxlength="1000" placeholder=""></textarea>
                  </label>
                </template>
                <div class="panel-actions">
                  <button v-if="photosStep === 1" type="button" class="visitor-pill-btn" @click="nextPhotosStep">Verder</button>
                  <button v-else-if="photosStep === 2" type="button" class="visitor-pill-btn" @click="postPhotoAndClose">Posten</button>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <label class="panel-field">
              <span>Jouw naam</span>
              <input v-model="visitorName" type="text" maxlength="80" @blur="applyVisitorName">
            </label>
            <label class="panel-field" v-if="activePanel === 'music' || activePanel === 'videos'">
              <span>Externe URL</span>
              <input v-model="externalUrl" type="url" placeholder="https://...">
            </label>
            <label class="panel-field" v-if="activePanel === 'photos' || activePanel === 'videos'">
              <span>Media URL (optioneel)</span>
              <input v-model="mediaUrl" type="url" placeholder="https://...">
            </label>
            <label class="panel-field" v-if="activePanel === 'photos' || activePanel === 'videos'">
              <span>Upload bestand</span>
              <input type="file" :accept="activePanel === 'photos' ? 'image/*' : 'video/*'" @change="onMediaFileChange">
            </label>
            <label class="panel-field">
              <span>Bericht</span>
              <textarea v-model="tributeText" rows="3" maxlength="1000" placeholder="Jouw bijdrage"></textarea>
            </label>
            <button type="button" class="visitor-pill-btn" :disabled="submitState.loading" @click="addContribution">
              {{ submitState.loading ? 'Opslaan...' : 'Bijdrage toevoegen' }}
            </button>
            <p v-if="submitState.error" class="visitor-status error">{{ submitState.error }}</p>
            <p v-if="submitState.success" class="visitor-status ok">{{ submitState.success }}</p>

            <ul class="room-contribution-items" v-if="filteredContributions.length">
              <li v-for="item in filteredContributions" :key="item._id" class="room-contribution-item">
                <div><strong>{{ item.giverName || 'Bezoeker' }}</strong></div>
                <div>{{ item.tributeText || '-' }}</div>
                <div class="small-url">{{ item.mediaUrl || item.externalUrl || '-' }}</div>

                <div v-if="item.mediaUrl" class="contribution-preview">
                  <img v-if="item.type === 'photo' || isImageUrl(item.mediaUrl)" :src="item.mediaUrl" alt="Foto" class="contribution-preview-image">
                  <video v-else-if="item.type === 'video_file' || isVideoUrl(item.mediaUrl)" :src="item.mediaUrl" controls class="contribution-preview-video" />
                </div>

                <div v-if="item.externalUrl" class="contribution-preview">
                  <iframe v-if="getYouTubeEmbedUrl(item.externalUrl)" class="contribution-preview-embed" :src="getYouTubeEmbedUrl(item.externalUrl)" title="YouTube" />
                  <iframe v-else-if="getSpotifyEmbedUrl(item.externalUrl)" class="contribution-preview-embed" :src="getSpotifyEmbedUrl(item.externalUrl)" title="Spotify" />
                  <audio v-else-if="isAudioUrl(item.externalUrl)" :src="item.externalUrl" controls class="contribution-preview-audio" />
                  <a v-else :href="item.externalUrl" target="_blank" rel="noopener noreferrer">Open link</a>
                </div>

                <div class="item-reactions-row">
                  <button type="button" class="reaction-chip" @click="toggleContributionReaction(item._id, 'heart')">❤ <span class="reaction-count">{{ item.reactions?.heartCount || 0 }}</span></button>
                  <button type="button" class="reaction-chip" @click="toggleContributionReaction(item._id, 'support')">🤝 <span class="reaction-count">{{ item.reactions?.supportCount || 0 }}</span></button>
                  <button type="button" class="reaction-chip" @click="toggleContributionReaction(item._id, 'candle')">🕯 <span class="reaction-count">{{ item.reactions?.candleCount || 0 }}</span></button>
                </div>

                <form class="item-comment-form" @submit.prevent="submitContributionComment(item._id)">
                  <input v-model="commentDrafts[item._id]" type="text" maxlength="500" placeholder="Comment op deze bijdrage">
                  <button type="submit" class="visitor-pill-btn" :disabled="commentStateByItem[item._id]?.loading">
                    {{ commentStateByItem[item._id]?.loading ? 'Bezig...' : 'Plaats' }}
                  </button>
                </form>
                <div v-if="commentStateByItem[item._id]?.error" class="visitor-status error">{{ commentStateByItem[item._id].error }}</div>

                <ul class="item-comments-items" v-if="item.comments?.length">
                  <li v-for="comment in item.comments" :key="comment._id || comment.createdAt" class="item-comment-entry">
                    <span class="item-comment-author">{{ comment.displayName || 'Bezoeker' }}:</span>
                    <span>{{ comment.text }}</span>
                  </li>
                </ul>
              </li>
            </ul>
            <p v-else class="visitor-status">Nog geen bijdragen in deze categorie.</p>
          </template>
        </div>

        <!-- candle detail footer: place button below the panel when viewing candle details -->
        <div v-if="isCandleDetailsPanel" class="panel-footer candle-panel-footer">
          <div class="panel-footer-inner">
            <button type="button" class="visitor-pill-btn candle-detail-place-btn" @click="showCandleComposer">
              <span aria-hidden="true">＋</span>
              <span>Kaars plaatsen</span>
            </button>
          </div>
        </div>

      </section>

      <p v-if="profileHint" class="visitor-profile-hint">{{ profileHint }}</p>
    </div>
  </div>
</template>

<style scoped>
.visitor-page-v3 {
  --visitor-color-dark: var(--brand-dark);
  --visitor-color-light: var(--brand-light);
  --visitor-ink: var(--editor-text);
  --visitor-soft: color-mix(in srgb, var(--brand-light) 24%, transparent);
  --visitor-soft-2: color-mix(in srgb, var(--brand-light) 42%, transparent);
  --visitor-card: rgba(255, 255, 255, 0.88);
  --visitor-border: color-mix(in srgb, var(--brand-dark) 24%, transparent);
  --visitor-btn-text: #ffffff;
  min-height: 100vh;
background: linear-gradient(
  180deg,
  white 0%,
  color-mix(in srgb, var(--brand-light) 72%, white) 28%,
  color-mix(in srgb, var(--brand-light) 64%, white) 60%,
  color-mix(in srgb, var(--brand-dark) 48%, var(--brand-light)) 100%
);
  color: var(--visitor-ink);
  padding: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.visitor-page-v3::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
  180deg,
  rgba(255, 255, 255, 0) 0%,
  rgba(255, 255, 255, 0) 30%,
  color-mix(in srgb, var(--brand-dark) 12%, transparent) 60%,
  color-mix(in srgb, var(--brand-dark) 24%, transparent) 100%
);
  z-index: 0;
}

.visitor-shell,
.visitor-gallery-shell,
.visitor-entry-wrap {
  position: relative;
  z-index: 1;
}

.visitor-entry-wrap {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  box-sizing: border-box;
  overflow: hidden;
}

.visitor-entry-wrap::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: url('/img/background-element.svg');
  background-repeat: no-repeat;
  background-position: left -120px bottom -70px;
  background-size: min(900px, 72vw);
  opacity: 0.22;
}

.visitor-entry-card {
  width: min(760px, 100%);
  min-height: 420px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid var(--visitor-border);
  box-shadow: 0 24px 54px rgba(11, 63, 116, 0.18);
  display: grid;
  place-items: center;
  padding: 34px 28px;
  backdrop-filter: blur(4px);
  position: relative;
  overflow: hidden;
}

.add-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.add-steps .step-box {
  display: flex;
  gap: 12px;
  align-items: center;
  background: #f6fbff;
  padding: 12px;
  border-radius: 10px;
  box-shadow: 0 6px 18px rgba(11,63,116,0.06);
}
.add-steps .step-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #eaf6ff;
  display: grid;
  place-items: center;
  font-weight: 700;
  color: #0b4b80;
}
.add-steps .step-content p{ margin:0; color:#52768a; font-size:0.9rem }
.panel-actions { margin-top:12px }

.visitor-entry-card::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 88%, color-mix(in srgb, var(--brand-light) 16%, transparent) 0%, transparent 28%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.06) 100%);
}

.visitor-entry-hero {
  position: relative;
  z-index: 1;
  width: min(520px, 100%);
  display: grid;
  justify-items: center;
  gap: 18px;
  text-align: center;
}

.visitor-brand-logo {
  max-width: 160px;
  max-height: 44px;
  object-fit: contain;

}

.visitor-entry-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 78px;
}

.visitor-entry-logo-image {
  width: min(180px, 52vw);
  height: auto;
  display: block;
}

.visitor-entry-copy {
  margin: 0;
  font-size: 1.02rem;
  line-height: 1.4;
  color: var(--visitor-color-dark);
  max-width: 46ch;
  margin-top: 4px;
}

.visitor-entry-copy strong {
  font-weight: 700;
}

.visitor-entry-candle-scene {
  margin-top: 10px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 18px;
  min-height: 160px;
  width: 100%;
  position: relative;
}

.visitor-entry-candle-scene::before {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: min(220px, 70%);
  height: 18px;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(34, 52, 70, 0.2) 0%, rgba(34, 52, 70, 0) 72%);
}

.visitor-entry-candle {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.visitor-entry-candle-flame {
  position: relative;
  width: 34px;
  height: 50px;
  border-radius: 55% 55% 68% 68% / 72% 72% 42% 42%;
  background: radial-gradient(circle at 52% 24%, #fff2bf 0%, #f6be2c 44%, #d97a06 100%);
  box-shadow:
    0 4px 10px rgba(209, 119, 12, 0.34),
    0 0 16px rgba(246, 177, 43, 0.28);
  transform-origin: 50% 80%;
  animation: visitor-entry-flame-flicker 2.3s ease-in-out infinite;
}

.visitor-entry-candle.is-small .visitor-entry-candle-flame {
  width: 28px;
  height: 42px;
  animation-delay: 0.5s;
}

.visitor-entry-candle-wax {
  position: relative;
  margin-top: 10px;
  border-radius: 24px 24px 28px 28px;
  background:
    linear-gradient(180deg, #fffdfa 0%, #fff6e7 22%, #fbefd9 64%, #f1e0bf 100%);
  border: 1px solid rgba(219, 192, 146, 0.46);
  box-shadow:
    inset -8px 0 12px rgba(203, 166, 109, 0.25),
    inset 0 7px 10px rgba(255, 255, 255, 0.7),
    0 10px 16px rgba(46, 33, 71, 0.2);
}

.visitor-entry-candle.is-large .visitor-entry-candle-wax {
  width: 102px;
  height: 136px;
}

.visitor-entry-candle.is-small .visitor-entry-candle-wax {
  width: 74px;
  height: 98px;
  border-radius: 24px 24px 28px 28px;
}

.visitor-entry-button {
  margin-top: 4px;
  border: 0;
  border-radius: 999px;
  min-width: min(280px, 100%);
  padding: 16px 26px;
  font: inherit;
  font-size: 1.05rem;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(90deg, var(--visitor-color-dark), color-mix(in srgb, var(--visitor-color-light) 62%, var(--visitor-color-dark)));
  box-shadow: 0 14px 28px rgba(11, 63, 116, 0.22);
  transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
}

.visitor-entry-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 18px 34px rgba(11, 63, 116, 0.24);
  filter: brightness(1.03);
}

.visitor-entry-button:disabled {
  cursor: wait;
  opacity: 0.9;
}

@keyframes visitor-entry-flame-flicker {
  0% {
    transform: translateX(0) rotate(-2deg) scale(1);
    filter: brightness(1);
  }

  30% {
    transform: translateX(1px) rotate(2deg) scale(1.04, 0.97);
    filter: brightness(1.06);
  }

  60% {
    transform: translateX(-1px) rotate(-1deg) scale(0.98, 1.03);
    filter: brightness(0.97);
  }

  100% {
    transform: translateX(0) rotate(-2deg) scale(1);
    filter: brightness(1);
  }
}

.visitor-shell {
  min-height: 100vh;
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 12px;
  padding: 24px 24px 16px;
  box-sizing: border-box;
  overflow: visible;
}

.visitor-topbar {
  position: relative;
  z-index: 2;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.visitor-topbar h1 {
  margin: 0;
  font-size: clamp(1.15rem, 2vw, 1.7rem);
  font-weight: 700;
  color: var(--visitor-color-dark);
}

.visitor-topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.visitor-name-btn,
.visitor-user-btn {
  pointer-events: auto;
  background: var(--visitor-card);
  border-radius: 999px;
  color: var(--visitor-color-dark);
  height: 44px;
  cursor: pointer;
}

.visitor-reactions-btn {
  pointer-events: auto;
  border: 1px solid color-mix(in srgb, var(--visitor-color-dark) 16%, transparent);
  background: rgba(255, 255, 255, 0.94);
  border-radius: 999px;
  color: var(--visitor-color-dark);
  height: 44px;
  padding: 0 14px;
  font-weight: 700;
  cursor: pointer;
}

.visitor-name-input {
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid rgba(7,59,87,0.08);
  min-width: 140px;
  font: inherit;
  color: var(--visitor-color-dark);
}

.visitor-name-btn {
  padding: 0 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 220px;
}

.visitor-name-btn > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visitor-user-btn {
  width: 44px;
}

.visitor-stage {
  position: absolute;
  inset: 0;
  min-height: 100%;
  height: 100%;
  z-index: 1;
  overflow: hidden;
}

.visitor-scene-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.visitor-scene {
  width: 100%;
  height: 100%;
}

.visitor-candles {
  position: absolute;
  bottom: 20px;
  font-size: 42px;
  opacity: 0.9;
}

.visitor-candles.left {
  left: 18%;
}

.visitor-candles.right {
  right: 18%;
}

.visitor-footer {
  position: relative;
  z-index: 2;
  pointer-events: none;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 16px;
  align-items: end;
}

.visitor-footer > .visitor-pill-btn {
  grid-column: 1;
  justify-self: start;
}

.visitor-pill-btn {
  pointer-events: auto;
  border: 0;
  background: linear-gradient(20deg, var(--visitor-color-dark), var(--visitor-color-light));
  color: var(--visitor-btn-text);
  border-radius: 14px;
  padding: 10px 18px;
  font-weight: 600;
  cursor: pointer;
}

.visitor-action-bar {
  pointer-events: auto;
  grid-column: 2;
  justify-self: center;
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.visitor-action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  min-width: auto;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--visitor-color-dark);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.visitor-action-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: color-mix(in srgb, var(--visitor-color-dark) 12%, white);
  color: var(--visitor-color-dark);
  border: 2px solid color-mix(in srgb, var(--visitor-color-dark) 8%, transparent);
  overflow: hidden;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12);
}

.icon-shape {
  width: 40px;
  height: 40px;

  background-color: var(--visitor-color-dark);

  -webkit-mask-position: center;
  -webkit-mask-size: contain;
  -webkit-mask-repeat: no-repeat;

  mask-position: center;
  mask-size: contain;
  mask-repeat: no-repeat;
}

.icon-message {
  -webkit-mask-image: url('/img/icons/icon_bericht.svg');
  mask-image: url('/img/icons/icon_bericht.svg');
}

.icon-kaars {
  -webkit-mask-image: url('/img/icons/icon_kaars.svg');
  mask-image: url('/img/icons/icon_kaars.svg');
}

.icon-video {
  -webkit-mask-image: url('/img/icons/icon_video.svg');
  mask-image: url('/img/icons/icon_video.svg');
}

.icon-muziek {
  -webkit-mask-image: url('/img/icons/icon_muziek.svg');
  mask-image: url('/img/icons/icon_muziek.svg');
}

.icon-foto {
  -webkit-mask-image: url('/img/icons/icon_foto.svg');
  mask-image: url('/img/icons/icon_foto.svg');
} 

.visitor-action-icon img {
  width: 40px;
  height: 40px;
  object-fit: contain;
  color: var(--visitor-color-dark);
}

.visitor-action-label {
  display: block;
  font-size: 0.8rem;
  text-align: center;
  padding: 0 8px;
color: color-mix(in srgb, var(--visitor-color-dark) 85%, black);

text-shadow:
  0 0 6px rgba(255, 255, 255, 0.9),
  0 0 10px rgba(255, 255, 255, 0.6),
  0 0 16px rgba(255, 255, 255, 0.4);
}
.visitor-action-btn:hover .visitor-action-icon {
  background: color-mix(in srgb, var(--visitor-color-dark) 18%, white);
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
}

.visitor-action-btn.active .visitor-action-icon {
  background: color-mix(in srgb, var(--visitor-color-dark) 20%, white);
  border-color: var(--visitor-color-dark);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}

.visitor-brand-card {
  pointer-events: auto;
  justify-self: end;
  border-radius: 10px;
  background: white;
  padding: 15px 20px;
  min-width: 150px;
  display: grid;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.visitor-brand-card strong {
  font-size: 1.08rem;
}

.visitor-panel {
  position: fixed;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  width: min(980px, calc(100vw - 20px));
  max-height: 76vh;
  overflow: auto;
  background: rgba(255, 255, 255, 0.97);
  border: 1px solid var(--visitor-border);
  border-radius: 14px;
  box-shadow: 0 24px 56px rgba(11, 63, 116, 0.2);
  z-index: 50;
}

.visitor-panel--side {
  left: 14px;
  right: auto;
  top: 84px;
  bottom: 20px;
  transform: none;
  width: min(360px, 92vw);
  max-height: calc(100vh - 80px);
  background: linear-gradient(180deg, color-mix(in srgb, var(--visitor-color-light) 22%, white) 0%, color-mix(in srgb, var(--visitor-color-light) 8%, white) 100%);
  border: none;
  box-shadow: 0 30px 60px rgba(11, 63, 116, 0.18);
  padding: 0;
  display: flex;
  flex-direction: column;
  z-index: 10020;
  pointer-events: auto;
}

.visitor-panel--side-right {
  left: auto;
  right: 14px;
}

.visitor-panel--candle-detail {
  width: min(330px, 88vw);
  top: 50%;
  bottom: auto;
  height: auto;
  max-height: calc(100vh - 104px);
  border-radius: 18px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--visitor-color-light) 28%, white) 0%, color-mix(in srgb, var(--visitor-color-light) 10%, white) 100%);
  box-shadow: 0 30px 60px color-mix(in srgb, var(--visitor-color-dark) 12%, rgba(11,63,116,0.18));
  border: none;
  overflow: visible;
  padding-bottom: 84px;
  transform: translateX(0) translateY(-50%);
}

.visitor-panel--candle-detail .visitor-panel-head {
  padding: 20px 16px 8px 16px;
  align-items: flex-start;
  background: transparent;
  border-radius: 18px 18px 0 0;
  border: none;
  position: relative;
}

.visitor-panel--candle-detail .panel-head-left strong {
  font-size: 1.45rem;
  line-height: 1.08;
  color: var(--visitor-color-dark);
  font-weight: 800;
  max-width: 220px;
}

.visitor-close-soft {
  width: 30px;
  height: 30px;
  border: 0;
  background: transparent;
  color: var(--visitor-color-dark);
  font-size: 1.4rem;
  line-height: 1;
  padding: 0;
  position: absolute;
  top: 12px;
  right: 12px;
}

.visitor-panel--candle-detail .visitor-panel-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 16px 18px 16px;
  overflow: auto;
  background: transparent;
}

.visitor-panel--side-right {
  width: 320px;
  top: calc(50% - 240px);
  bottom: auto;
  height: 480px;
  max-height: 90vh;
  border-radius: 18px;
  box-shadow: 0 18px 40px rgba(7,59,87,0.14);
}

.visitor-panel--side-right .visitor-panel-body {
  padding: 18px 18px 0 18px; /* flush bottom padding so input can sit fully at the bottom */
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden; /* comment list will scroll instead */
}

.visitor-panel--side-right .item-comment-entry {
  display: block;
  padding: 12px;
  background: #ffffff;
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(11,63,116,0.06);
  margin-bottom: 12px;
}

.visitor-panel--side-right .item-comment-author {
  display: block;
  font-weight: 700;
  color: var(--visitor-color-dark);
  margin-bottom: 8px;
}

.visitor-panel--side-right .item-comments-items {
  padding: 4px 0 0 0;
  flex: 1 1 auto;
  overflow: auto;
}

.visitor-panel--side-right .item-comment-form {
  position: static;
  margin-top: 6px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
  background: transparent;
  padding-top: 6px;
  z-index: 60;
}

.visitor-panel--side-right .item-comment-form input[type="text"] {
  flex: 1;
  padding: 12px 16px;
  border-radius: 28px;
  border: 1px solid rgba(7,59,87,0.08);
  background: #fff;
  box-shadow: inset 0 1px 0 rgba(11,63,116,0.02);
  color: #567a8f;
}

.visitor-panel--side-right .item-comment-form textarea {
  flex: 1;
  padding: 12px 16px;
  border-radius: 28px;
  border: 1px solid rgba(7,59,87,0.08);
  background: #fff;
  box-shadow: inset 0 1px 0 rgba(11,63,116,0.02);
  color: #567a8f;
  resize: none;
  overflow: hidden;
  min-height: 44px;
  max-height: 160px;
  line-height: 1.35;
}

.visitor-panel--side-right .item-comment-form .visitor-pill-btn {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.visitor-panel--side-right .item-comment-form .visitor-pill-btn {
  background: var(--visitor-color-dark);
  color: var(--visitor-btn-text);
  border: none;
  box-shadow: 0 6px 18px rgba(7,59,87,0.12);
}

.visitor-panel--side-right .item-comment-form .visitor-pill-btn svg { width:18px; height:18px; fill:currentColor }

/* Hide contribution reaction controls inside the messages right-side panel */
.visitor-panel--side-right .visitor-gallery-reaction-toggle,
.visitor-panel--side-right .visitor-gallery-reaction-btn,
.visitor-panel--side-right .reaction-chip,
.visitor-panel--side-right .visitor-gallery-reaction-panel {
  display: none !important;
}

.visitor-panel--side .visitor-panel-head {
  background: transparent;
  padding: 22px 18px 8px 18px;
  border-bottom: none;
  align-items: center;
}

.panel-head-left { display:flex; gap:10px; align-items:center }
.panel-head-right { display:flex; gap:8px; align-items:center }
.visitor-back { background:transparent; border:0; color:var(--visitor-color-dark); font-weight:700; cursor:pointer }
.panel-head-right small { color:var(--visitor-color-dark); font-weight:700 }

.steps-container { display:flex; flex-direction:column; gap:12px }
.steps-progress { padding: 0 6px; margin-top: 6px }
.steps-track { width: 160px; height: 8px; background: rgba(7,59,87,0.08); border-radius: 8px; display:flex; gap:6px; padding:4px }
.step-seg { flex:1; height:100%; background: rgba(255,255,255,0.6); border-radius: 6px }
.step-seg.active { background: linear-gradient(90deg,#072b4c,#1a6b9a) }

.music-url-input { width:100%; border:1px solid var(--visitor-border); padding:10px; border-radius:8px }
.music-preview-box { background:#fff; border-radius:10px; padding:8px }
.music-no-preview { color:#567a8f; padding:12px }

.candle-detail-card {
  background: #ffffff;
  border-radius: 12px;
  border: none;
  padding: 12px;
  box-shadow: 0 6px 20px rgba(11,63,116,0.06);
}

.candle-detail-frame {
  background: transparent;
  border-radius: 0;
  box-shadow: none;
  padding: 0;
}

.candle-compose-icon-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 90px;
  margin-top: 2px;
}

.candle-compose-flame {
  width: 24px;
  height: 30px;
  border-radius: 65% 65% 50% 50%;
  background: radial-gradient(circle at 46% 34%, #ffe6a0 8%, #f3b13a 44%, #cb7d10 86%);
  box-shadow: 0 0 0 14px rgba(246, 198, 92, 0.24), 0 0 20px rgba(245, 168, 45, 0.44);
}

.candle-compose-body {
  width: 32px;
  height: 54px;
  margin-top: 5px;
  border-radius: 4px;
  background: linear-gradient(180deg, #fffdf8 0%, #f1ebdc 100%);
  border: 1px solid rgba(176, 146, 90, 0.22);
  box-shadow: inset -6px 0 8px rgba(176, 146, 90, 0.22);
}

.candle-compose-divider {
  border: 0;
  height: 2px;
  margin: 2px 0 0;
  background: color-mix(in srgb, var(--visitor-color-dark) 12%, transparent);
}

.candle-detail-icon-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 94px;
  margin-top: 0;
}

.candle-detail-flame {
  width: 24px;
  height: 30px;
  border-radius: 65% 65% 50% 50%;
  background: radial-gradient(circle at 46% 34%, #ffe6a0 8%, #f3b13a 44%, #cb7d10 86%);
  box-shadow: 0 0 0 14px rgba(246, 198, 92, 0.24), 0 0 20px rgba(245, 168, 45, 0.44);
}

.candle-detail-body {
  width: 32px;
  height: 54px;
  margin-top: 5px;
  border-radius: 4px;
  background: linear-gradient(180deg, #fffdf8 0%, #f1ebdc 100%);
  border: 1px solid rgba(176, 146, 90, 0.22);
  box-shadow: inset -6px 0 8px rgba(176, 146, 90, 0.22);
}

.candle-detail-divider {
  border: 0;
  height: 2px;
  margin: 2px 0 0;
  background: color-mix(in srgb, var(--visitor-color-dark) 12%, transparent);
}

.candle-detail-label {
  margin: 0 0 8px 0;
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--visitor-color-dark);
}

.candle-detail-giver {
  margin: 0 0 6px 0;
  font-weight: 700;
  color: var(--visitor-color-dark);
}

.candle-detail-text {
  margin: 0;
  color: #3d5b6d;
  white-space: pre-wrap;
  font-size: 0.98rem;
  line-height: 1.4;
  min-height: 74px;
}

.candle-detail-reactions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 16px;
  margin-top: 18px;
  margin-bottom: 6px;
}

.candle-detail-reaction-chip,
.candle-detail-chat-chip {
  border: 0;
  background: transparent;
  color: var(--visitor-color-dark);
  font-size: 1.9rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.candle-detail-reaction-chip span {
  position: absolute;
  top: -4px;
  right: -8px;
  display: inline-flex;
  min-width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--visitor-color-dark);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0 4px;
}

.candle-detail-actions {
  margin-top: 8px;
}

.candle-detail-place-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 1.6rem;
  font-weight: 700;
  border-radius: 18px;
  padding: 14px 12px;
  background: linear-gradient(25deg, var(--visitor-color-dark) 0%, var(--visitor-color-light) 100%);
  width: 100%;
}

.candle-detail-place-btn span:first-child {
  font-size: 1.7rem;
  line-height: 1;
}

.visitor-panel--side:not(.visitor-panel--candle-detail) .visitor-panel-body {
  padding: 12px 18px 18px 18px;
  overflow: auto;
  flex: 1 1 auto;
}

.panel-footer { padding: 12px 18px; border-top: 1px solid rgba(7,59,87,0.06); background: transparent }
.panel-footer-inner { max-width:100%; }
.panel-footer .visitor-pill-btn { width:100% }

.candle-panel-footer {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: -70px;
  display: flex;
  justify-content: center;
  pointer-events: auto;
  z-index: 5;
}

.candle-detail-place-btn {
  width: 100%;
  max-width: 300px;
  border-radius: 20px;
  padding: 13px 16px;
  font-size: 1.15rem;
}

.add-steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: #073b57;
}

.add-steps .step-box {
  display: none;
}

.add-steps .step-box:first-child .step-content strong {
  font-size: 1.8rem;
  display: block;
  margin-bottom: 6px;
}

.add-steps .step-box .step-content p {
  margin: 0 0 12px 0;
  color: #567a8f;
}

.add-steps .panel-actions {
  margin-top: 12px;
}

.add-steps .step-icon {
  display: inline-block;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(180deg,#073b57,#1a6b9a);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
}

.add-steps .upload-box {
  background: #fff;
  border-radius: 12px;
  padding: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(7,59,87,0.12);
}

.steps-body { display:flex; flex-direction:column; gap:12px }
.steps-title strong { font-size: 1.9rem; color:#073b57 }
.steps-subtitle { font-size: 1rem; color:#083b57; font-weight:700 }
.steps-desc { color:#4f6b7a; margin:4px 0 8px 0 }
.upload-box { height: 120px; padding: 32px; border-radius: 14px; box-shadow: 0 6px 18px rgba(10,82,112,0.06) }
.upload-box svg { width: 140px; height: 96px }

.upload-preview img { width: 140px; max-width: 100%; height: auto; border-radius: 12px; object-fit: cover; display:block }
.upload-box { height: auto; max-height: 220px; overflow: hidden }
.upload-meta { display:flex; align-items:center; gap:12px; margin-bottom:8px; justify-content:space-between }
.upload-filename { color:#173b52; font-size:0.95rem }
.upload-delete { background:transparent; border:0; cursor:pointer; color:#0a5270 }
.sr-only { position:absolute; left:-9999px }

.steps-sep { border:0; height:1px; background: linear-gradient(90deg, rgba(10,82,112,0.06), rgba(10,82,112,0.04)); margin:12px 0 }

.add-steps .upload-box img{ max-width: 120px }

.visitor-panel--side .visitor-pill-btn {
  width: 100%;
  border-radius: 12px;
  padding: 12px 16px;
}

.visitor-panel--side .visitor-pill-btn.secondary {
  background: #ffffff;
  color: #083b57;
  border: 1px solid rgba(7, 59, 87, 0.18);
}

.visitor-panel-head {
  position: sticky;
  top: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--visitor-border);
  background: #fff;
}

.visitor-close {
  width: 32px;
  height: 32px;
  border: 1px solid var(--visitor-border);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}

.visitor-panel-body {
  display: grid;
  gap: 12px;
  padding: 12px;
}

.panel-field {
  display: grid;
  gap: 6px;
}

.panel-field input,
.panel-field textarea {
  border: 1px solid var(--visitor-border);
  border-radius: 8px;
  padding: 9px 10px;
}

.room-contribution-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.room-contribution-item {
  border: 1px solid var(--visitor-border);
  border-radius: 10px;
  background: #fff;
  padding: 10px;
  display: grid;
  gap: 8px;
}

.small-url {
  font-size: 0.82rem;
  color: #506476;
  word-break: break-all;
}

.contribution-preview-image,
.contribution-preview-video,
.contribution-preview-embed {
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--visitor-border);
}

.contribution-preview-image,
.contribution-preview-video {
  max-height: 280px;
  object-fit: cover;
}

.contribution-preview-embed {
  aspect-ratio: 16 / 9;
}

.contribution-preview-audio {
  width: 100%;
}

.item-reactions-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.reaction-chip {
  border: 1px solid var(--visitor-border);
  background: #fff;
  border-radius: 999px;
  padding: 6px 8px;
  cursor: pointer;
}

.reaction-count {
  display: inline-flex;
  min-width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  margin-left: 6px;
  padding: 0 6px;
  background: var(--visitor-color-dark);
  color: var(--visitor-btn-text);
  border-radius: 999px;
}

.item-comment-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}

.item-comment-form input {
  border: 1px solid var(--visitor-border);
  border-radius: 8px;
  padding: 9px 10px;
}

.item-comments-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.item-comment-entry {
  font-size: 0.92rem;
}

.item-comment-author {
  font-weight: 600;
}

.visitor-status {
  margin: 0;
  color: #415566;
}

.visitor-status.error {
  color: #9d2f2f;
}

.visitor-status.ok {
  color: #1c7d4a;
}

.visitor-profile-hint {
  margin: 6px 4px 0;
  color: #8b2f2f;
}

.roomMusicLine {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.visitor-user-btn {
  width: auto;
  min-width: 108px;
  padding: 0 16px;
}

.visitor-gallery-shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 12px;
  padding: 18px 16px 12px;
  box-sizing: border-box;
  background:
    radial-gradient(circle at 8% 100%, color-mix(in srgb, var(--brand-dark) 28%, transparent) 0%, rgba(255, 255, 255, 0) 17%),
    radial-gradient(circle at 92% 100%, color-mix(in srgb, var(--brand-dark) 42%, transparent) 0%, rgba(255, 255, 255, 0) 16%),
    linear-gradient(180deg, color-mix(in srgb, var(--brand-dark) 90%, black) 0%, color-mix(in srgb, var(--brand-dark) 78%, var(--brand-light)) 62%, color-mix(in srgb, var(--brand-dark) 68%, var(--brand-light)) 100%);
  color: var(--visitor-ink);
}

.visitor-gallery-shell.vr-mode-active {
  min-height: 100vh;
  padding: 0;
  gap: 0;
  grid-template-rows: minmax(0, 1fr);
  background: #0d1820;
}

.visitor-gallery-topbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
}

.visitor-back-btn {
  align-self: end;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  color: var(--visitor-color-dark);
  padding: 10px 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 10px 28px rgba(11, 63, 116, 0.14);
}

.visitor-back-btn-gallery {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2;
}

.visitor-title-card {
  justify-self: start;
  align-self: start;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.96);
  color: var(--visitor-color-dark);
  box-shadow: 0 10px 28px rgba(11, 63, 116, 0.16);
}

.visitor-title-card h1 {
  margin: 0;
  font-size: clamp(1rem, 1.8vw, 1.35rem);
  font-weight: 700;
  line-height: 1;
  color: var(--brand-dark);
}

.visitor-gallery-main {
  display: grid;
  place-items: stretch;
  min-height: 0;
}

.visitor-gallery-main.is-vr {
  place-items: stretch;
  padding: 0;
  background: #0d1820;
}

.visitor-gallery-frame {
  position: relative;
  min-height: 100%;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  align-content: center;
  gap: 16px;
  padding: 0 6px;
}

.visitor-gallery-panel {
  width: min(1150px, calc(100vw - 180px));
  margin: 0 auto;
  min-height: min(560px, calc(100vh - 240px));
  background: color-mix(in srgb, white 92%, var(--brand-light) 8%);
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--brand-dark) 16%, white);
  box-shadow: 0 24px 52px color-mix(in srgb, var(--brand-dark) 16%, transparent);
  padding: 12px;
  display: grid;
  gap: 10px;
  align-content: start;
  grid-auto-rows: max-content;
  box-sizing: border-box;
}

.visitor-gallery-candle {
  position: absolute;
  bottom: 10px;
  width: 190px;
  display: flex;
  align-items: flex-end;
  gap: 14px;
  filter: drop-shadow(0 0 28px rgba(255, 207, 94, 0.42));
}

.visitor-gallery-candle.left {
  left: 18px;
}

.visitor-gallery-candle.right {
  right: 28px;
}

.visitor-gallery-candle .visitor-entry-candle {
  transform-origin: center bottom;
  transform: scale(0.82);
}

.visitor-gallery-candle.right .visitor-entry-candle {
  transform: scale(0.9);
}

.visitor-gallery-candle .visitor-entry-candle-wax {
  box-shadow:
    inset -6px 0 10px rgba(203, 166, 109, 0.22),
    inset 0 5px 8px rgba(255, 255, 255, 0.72),
    0 8px 12px rgba(46, 33, 71, 0.16);
}

.visitor-gallery-heading {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding: 6px 6px 0;
}

.visitor-gallery-kicker {
  margin: 0 0 2px;
  color: #4f7598;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.visitor-gallery-heading h2 {
  margin: 0;
  color: var(--visitor-color-dark);
  font-size: clamp(1rem, 2.1vw, 1.4rem);
}

.visitor-gallery-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: 74px;
  gap: 8px;
  min-height: 0;
  overflow: auto;
  padding: 2px;
}

.visitor-gallery-grid.is-media {
  /* use smaller square tiles by allowing more columns with a minimum width */
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  grid-auto-rows: 1fr;
  gap: 10px;
}

.visitor-gallery-card {
  display: block;
}

.visitor-gallery-card.tile-1,
.visitor-gallery-card.tile-4 {
  grid-column: span 3;
  grid-row: span 2;
}

.visitor-gallery-card.tile-2,
.visitor-gallery-card.tile-5 {
  grid-column: span 3;
  grid-row: span 3;
}

.visitor-gallery-card.tile-3,
.visitor-gallery-card.tile-6 {
  grid-column: span 2;
  grid-row: span 2;
}

.visitor-gallery-card.tile-7 {
  grid-column: span 4;
  grid-row: span 2;
}

.visitor-gallery-media-card {
  display: grid;
  gap: 8px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--brand-dark) 12%, transparent);
  background: color-mix(in srgb, white 90%, var(--brand-light) 10%);
}

.visitor-gallery-media {
  width: 100%;
  height: 100%;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(180deg, color-mix(in srgb, var(--brand-light) 72%, white), color-mix(in srgb, var(--brand-light) 52%, var(--brand-dark)));
  border: 1px solid color-mix(in srgb, var(--brand-dark) 18%, transparent);
  box-shadow: 0 8px 20px color-mix(in srgb, var(--brand-dark) 10%, transparent);
}

/* Make media tiles square in media galleries */
.visitor-gallery-grid.is-media .visitor-gallery-media {
  aspect-ratio: 1 / 1;
  height: auto;
  max-width: 220px;
  margin: 0 auto;
}

.visitor-gallery-grid.is-media .visitor-gallery-image,
.visitor-gallery-grid.is-media .visitor-gallery-video,
.visitor-gallery-grid.is-media .visitor-gallery-embed,
.visitor-gallery-grid.is-media .visitor-gallery-audio {
  width: 100%;
  height: 100%;
}

.visitor-gallery-grid.is-media .visitor-gallery-embed {
  display: block;
}

.visitor-gallery-grid.is-media .visitor-gallery-embed iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

.visitor-gallery-image,
.visitor-gallery-video,
.visitor-gallery-embed,
.visitor-gallery-audio {
  display: block;
  width: 100%;
  height: 100%;
}

.visitor-gallery-image,
.visitor-gallery-video {
  object-fit: cover;
}

.visitor-gallery-embed {
  border: 0;
}

.visitor-gallery-audio {
  min-height: 90px;
}

.visitor-gallery-placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  gap: 6px;
  padding: 16px;
  text-align: center;
  color: #45627d;
}

.visitor-gallery-placeholder strong {
  color: var(--visitor-color-dark);
}

.visitor-gallery-copy {
  padding: 0 4px 2px;
  display: grid;
  gap: 2px;
  color: var(--visitor-color-dark);
}

.visitor-gallery-copy strong {
  font-size: 0.95rem;
}

.visitor-gallery-copy p {
  margin: 0;
  color: color-mix(in srgb, var(--brand-dark) 72%, white);
  font-size: 0.88rem;
  line-height: 1.35;
  line-clamp: 2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.visitor-gallery-empty {
  margin: 12px 0;
  color: color-mix(in srgb, var(--brand-dark) 72%, white);
}

.visitor-gallery-lightbox {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(5, 22, 39, 0.48);
  display: grid;
  place-items: center;
  z-index: 9999;
  padding: 28px;
}

.visitor-gallery-lightbox-card {
  position: relative;
  width: min(1160px, calc(100% - 80px));
  min-height: min(720px, calc(100% - 120px));
  max-height: calc(100vh - 120px);
  background: color-mix(in srgb, white 92%, var(--brand-light) 8%);
  border-radius: 18px;
  box-shadow:
    0 28px 60px color-mix(in srgb, var(--brand-dark) 28%, transparent),
    0 10px 24px color-mix(in srgb, var(--brand-dark) 14%, transparent);
  filter: drop-shadow(0 8px 18px color-mix(in srgb, var(--brand-light) 10%, transparent));
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 26px;
  padding: 24px 26px 28px 22px;
  align-items: center;
  overflow: hidden;
}

.visitor-gallery-lightbox-close {
  position: absolute;
  right: 18px;
  top: 18px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 0;
  background: color-mix(in srgb, white 96%, var(--brand-light) 4%);
  color: var(--visitor-color-dark);
  font-size: 1.6rem;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 6px 18px color-mix(in srgb, var(--brand-dark) 14%, transparent);
  z-index: 60;
}

.visitor-gallery-lightbox-info {
  background: linear-gradient(180deg, color-mix(in srgb, var(--brand-light) 34%, white), color-mix(in srgb, var(--brand-light) 10%, white));
  border-radius: 14px;
  padding: 18px;
  display: grid;
  align-content: start;
  gap: 12px;
  height: 100%;
  box-shadow:
    0 18px 38px color-mix(in srgb, var(--brand-dark) 18%, transparent),
    0 4px 10px color-mix(in srgb, var(--brand-dark) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--brand-dark) 10%, transparent);
}

.visitor-gallery-lightbox-info h3 {
  margin: 0;
  font-size: 2.2rem;
  line-height: 1.02;
  color: var(--visitor-color-dark);
  font-weight: 800;
}

.visitor-gallery-lightbox-label {
  margin: 0;
  color: color-mix(in srgb, var(--visitor-color-dark) 82%, black);
  font-size: 0.95rem;
  font-weight: 600;
}

.visitor-gallery-lightbox-message {
  min-height: 160px;
  background: color-mix(in srgb, white 96%, var(--brand-light) 4%);
  border-radius: 10px;
  padding: 14px;
  color: color-mix(in srgb, var(--visitor-color-dark) 78%, black);
  font-size: 1rem;
  height: auto;
}

.visitor-gallery-lightbox-reactions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.visitor-gallery-lightbox-reactions-wrap {
  position: relative;
  min-height: 72px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  width: 100%;
  padding-right: 54px;
}

.visitor-gallery-comment-toggle {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  padding: 0;
  cursor: pointer;
  display: grid;
  place-items: center;
  color: var(--visitor-color-dark);
}

.visitor-gallery-comment-icon {
  position: relative;
  width: 24px;
  height: 18px;
  border-radius: 6px;
  background: var(--visitor-color-dark);
}

.visitor-gallery-comment-icon::after {
  content: '';
  position: absolute;
  right: 3px;
  bottom: -4px;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--visitor-color-dark);
  transform: rotate(45deg);
}

.visitor-gallery-reaction-panel {
  position: absolute;
  left: calc(100% + 12px);
  top: 50%;
  transform: translateY(-50%);
  /* match the width of the info card (parent is 100% of that card) but cap on very wide screens */
  width: min(480px, 100%);
  background: linear-gradient(180deg, color-mix(in srgb, var(--brand-light) 28%, white), color-mix(in srgb, var(--brand-light) 10%, white));
  border-radius: 24px;
  box-shadow: 0 16px 40px color-mix(in srgb, var(--brand-dark) 16%, transparent);
  border: 0;
  /* give extra top padding so the close button doesn't overlap comments */
  padding: 46px 12px 12px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: calc(100vh - 120px);
  justify-content: flex-start;
  z-index: 2;
}

.visitor-gallery-reaction-close {
  position: absolute;
  right: 10px;
  top: 10px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 0;
  background: color-mix(in srgb, white 96%, var(--brand-light) 4%);
  color: var(--visitor-color-dark);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 6px 18px color-mix(in srgb, var(--brand-dark) 14%, transparent);
}

/* Room reactions sidebar (fixed to right) */
.visitor-room-reaction-panel {
  position: fixed;
  right: 24px;
  top: 80px;
  width: min(420px, 38%);
  max-width: 520px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--brand-light) 28%, white), color-mix(in srgb, var(--brand-light) 10%, white));
  border-radius: 18px;
  box-shadow: 0 20px 48px color-mix(in srgb, var(--brand-dark) 18%, transparent);
  padding: 48px 16px 16px;
  z-index: 40;
  max-height: calc(100vh - 160px);
  overflow: auto;
}

.visitor-room-reaction-panel .visitor-gallery-comment-bubble.small {
  background: transparent;
  padding: 6px 0 12px 0;
}
.visitor-gallery-comments {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px; /* increased spacing between individual comments */
  flex: 1 1 auto;
  padding-right: 4px;
  align-items: stretch;
  -webkit-overflow-scrolling: touch;
}

.visitor-gallery-comment-entry {
  display: block;
  color: color-mix(in srgb, var(--visitor-color-dark) 88%, black);
  padding-bottom: 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--visitor-color-dark) 10%, transparent);
}

.visitor-gallery-comment-author-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.visitor-gallery-comment-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(180deg, color-mix(in srgb, var(--brand-light) 70%, white), color-mix(in srgb, var(--brand-light) 42%, var(--brand-dark)));
  box-shadow: 0 6px 16px color-mix(in srgb, var(--brand-dark) 14%, transparent);
  position: relative;
  flex: 0 0 auto;
}

.visitor-gallery-comment-avatar::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 8px;
  width: 10px;
  height: 10px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: var(--visitor-color-dark);
}

.visitor-gallery-comment-avatar::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 6px;
  width: 16px;
  height: 8px;
  transform: translateX(-50%);
  border-radius: 10px 10px 4px 4px;
  background: #0b4b80;
}

.visitor-gallery-comment-bubble {
  display: block;
  background: #ffffff;
  border-radius: 8px;
  padding: 12px 14px;
  box-shadow: 0 6px 18px rgba(11, 63, 116, 0.08);
  line-height: 1.45;
  color: #153242;
  margin-left: 48px;
}

.visitor-gallery-comment-entry .item-comment-author {
  font-size: 1.05rem;
  font-weight: 600;
  color: #153242;
}

.visitor-gallery-reaction-btn {
  border: 0;
  background: transparent;
  color: var(--visitor-color-dark);
  font-size: 1.1rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
}

.visitor-gallery-reaction-btn span {
  min-width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--visitor-color-dark);
  color: var(--visitor-btn-text);
  font-size: 0.66rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.visitor-gallery-comment-form {
  margin-top: 2px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.visitor-gallery-comment-form input[type="text"] {
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 10px;
  border: 0;
  box-shadow: inset 0 1px 2px color-mix(in srgb, var(--brand-dark) 6%, transparent);
}

.visitor-gallery-comment-form button {
  flex: 0 0 auto;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--visitor-color-dark);
  color: var(--visitor-btn-text);
  border: 0;
}

@media (max-width: 700px) {
  .visitor-gallery-reaction-panel {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    top: auto;
    bottom: 12px;
    width: 92vw;
    max-height: 70vh;
    border-radius: 12px;
  }
}

.visitor-gallery-comment-form input {
  border: 1px solid color-mix(in srgb, var(--visitor-color-dark) 22%, transparent);
  border-radius: 14px;
  padding: 10px 12px;
  background: color-mix(in srgb, white 96%, var(--brand-light) 4%);
  color: color-mix(in srgb, var(--visitor-color-dark) 82%, black);
}

.visitor-gallery-comment-form button {
  border: 0;
  border-radius: 14px;
  background: var(--visitor-color-dark);
  color: var(--visitor-btn-text);
  padding: 6px 12px;
  cursor: pointer;
}

.visitor-gallery-comment-form button:disabled {
  opacity: 0.7;
}

/* Darken comment submit buttons in other contexts (room/item forms) */
.item-comment-form button,
.item-comment-form .visitor-pill-btn {
  background: var(--visitor-color-dark);
  color: var(--visitor-btn-text);
  border: 0;
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
}
.item-comment-form button:hover,
.item-comment-form .visitor-pill-btn:hover {
  background: color-mix(in srgb, var(--visitor-color-dark) 85%, black);
}

.visitor-gallery-lightbox-media {
  position: relative;
  border-radius: 14px;
  background: transparent;
  border: 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 12px 18px 12px 12px;
  height: min(78vh, 720px);
  min-height: min(78vh, 720px);
  max-height: calc(100vh - 220px);
  width: min(100%, 760px);
  margin: 0 auto;
  overflow: hidden;
}

.visitor-gallery-lightbox-image,
.visitor-gallery-lightbox-video,
.visitor-gallery-lightbox-embed,
.visitor-gallery-lightbox-audio {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  border-radius: 12px;
  object-fit: contain;
}

.visitor-gallery-lightbox-video {
  width: auto;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  align-self: center;
  justify-self: center;
  background: #000;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.18);
  transform: translateX(-14px);
}

.visitor-gallery-lightbox-video--force {
  width: auto;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  transform: translateX(-14px);
}

/* ensure img/video elements never overflow and keep aspect ratio */
.visitor-gallery-lightbox-image img,
.visitor-gallery-lightbox-video video,
.visitor-gallery-lightbox-embed iframe {
  display: block;
  width: auto;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.visitor-gallery-lightbox-video video,
.visitor-gallery-lightbox-embed iframe,
.visitor-gallery-lightbox-audio audio {
  min-height: 100%;
}

.videos-step-preview-video {
  display: block;
  width: auto;
  height: min(360px, 48vh);
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
  object-fit: contain;
  background: #000;
}

.visitor-gallery-lightbox-embed {
  border: 0;
}

.visitor-gallery-lightbox-next {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  border: 0;
  background: transparent;
  color: #0b4b80;
  font-size: 2.6rem;
  line-height: 1;
  cursor: pointer;
}

.visitor-gallery-next {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 0;
  background: rgba(255, 255, 255, 0.22);
  color: white;
  font-size: 1.1rem;
  cursor: pointer;
  box-shadow: 0 8px 26px rgba(11, 63, 116, 0.2);
}

.visitor-gallery-next:disabled {
  opacity: 0.45;
  cursor: default;
}

.visitor-gallery-add {
  grid-column: 1;
  justify-self: start;
  align-self: center;
  border: 1px solid color-mix(in srgb, var(--visitor-color-dark) 38%, white);
  border-radius: 999px;
  padding: 13px 22px;
  font-weight: 800;
  background: linear-gradient(25deg, var(--visitor-color-dark) 0%, color-mix(in srgb, var(--visitor-color-light) 74%, var(--visitor-color-dark)) 100%);
  color: var(--visitor-btn-text);
  box-shadow:
    0 16px 30px color-mix(in srgb, var(--visitor-color-dark) 34%, transparent),
    0 0 0 2px color-mix(in srgb, var(--visitor-color-light) 22%, transparent) inset;
  cursor: pointer;
}

 

.visitor-gallery-add::before {
  content: '+';
  margin-right: 8px;
  font-size: 1.15rem;
}

.visitor-vr-entry-btn {
  position: absolute;
  top: 84px;
  right: 16px;
  z-index: 3;
  min-width: 108px;
  min-height: 58px;
  padding: 0 24px;
  border: 1px solid transparent;
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(235, 245, 255, 0.98) 100%) padding-box,
    linear-gradient(120deg, #ffffff 0%, #7ad6ff 45%, #ffffff 100%) border-box;
  color: #0a4170;
  font-size: 1.08rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.9);
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.22),
    0 14px 28px rgba(11, 63, 116, 0.24),
    0 0 24px rgba(122, 214, 255, 0.45);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
  animation: visitorVrPulse 2.4s ease-in-out infinite;
}

.visitor-vr-entry-btn::before {
  content: '✦';
  margin-right: 8px;
  font-size: 0.9rem;
  color: #1c88c8;
}

.visitor-vr-entry-btn:hover {
  transform: translateY(-2px) scale(1.02);
  filter: brightness(1.03);
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.34),
    0 18px 34px rgba(11, 63, 116, 0.28),
    0 0 30px rgba(122, 214, 255, 0.58);
}

.visitor-vr-entry-btn:active {
  transform: translateY(0) scale(0.99);
}

@keyframes visitorVrPulse {
  0%,
  100% {
    box-shadow:
      0 0 0 2px rgba(255, 255, 255, 0.22),
      0 14px 28px rgba(11, 63, 116, 0.24),
      0 0 24px rgba(122, 214, 255, 0.45);
  }
  50% {
    box-shadow:
      0 0 0 3px rgba(255, 255, 255, 0.35),
      0 16px 30px rgba(11, 63, 116, 0.26),
      0 0 34px rgba(122, 214, 255, 0.62);
  }
}

.visitor-gallery-footer {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  align-items: center;
}

.visitor-gallery-footer-vr {
  grid-template-columns: minmax(0, 1fr) auto;
}

.visitor-gallery-tabs {
  grid-column: 2;
  justify-self: center;
  display: flex;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
}

.visitor-gallery-footer > .visitor-brand-card {
  grid-column: 3;
  justify-self: end;
}

/* In gallery views only show the logo image; hide the title/subtitle text under it */
.visitor-gallery-panel .visitor-brand-card strong,
.visitor-gallery-panel .visitor-brand-card span,
.visitor-gallery-footer .visitor-brand-card strong,
.visitor-gallery-footer .visitor-brand-card span {
  display: none;
}

.visitor-gallery-kicker,
.visitor-gallery-copy strong,
.visitor-gallery-copy p,
.visitor-gallery-empty,
.visitor-brand-card strong,
.visitor-brand-card span {
  text-shadow:
    0 1px 1px rgba(255, 255, 255, 0.9),
    0 0 8px rgba(255, 255, 255, 0.3),
    0 0 1px rgba(0, 0, 0, 0.12);
}

.visitor-vr-stage {
  position: relative;
  min-height: min(72vh, 760px);
  width: min(980px, 100%);
  margin: 0 auto;
  border-radius: 22px;
  overflow: hidden;
  /* Keep stage visually consistent with the branding gradient; stronger dark bottom */
  background:
    radial-gradient(circle at center, color-mix(in srgb, var(--brand-light) 14%, transparent) 0%, transparent 18%),
    radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--brand-light) 8%, transparent) 0%, transparent 42%),
    linear-gradient(180deg, color-mix(in srgb, var(--brand-light) 86%, white) 0%, color-mix(in srgb, var(--brand-dark) 26%, var(--brand-light)) 62%, var(--brand-dark) 100%),
    radial-gradient(ellipse at bottom center, color-mix(in srgb, var(--brand-dark) 40%, transparent) 0%, transparent 42%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 24px 64px rgba(11, 63, 116, 0.18);
}

.visitor-vr-halo {
  position: absolute;
  inset: 12% 18%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.22), transparent 64%);
  filter: blur(10px);
}

.visitor-vr-core {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  width: min(280px, 70vw);
  aspect-ratio: 1;
  border-radius: 50%;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 24px;
  box-sizing: border-box;
  color: #fff;
  background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.08) 45%, rgba(255, 255, 255, 0.04) 60%, transparent 72%);
  border: 1px solid rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(4px);
}

.visitor-vr-core span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.visitor-vr-core strong {
  display: block;
  margin-top: 12px;
  font-size: 1.25rem;
}

.visitor-vr-core p {
  margin: 6px 0 0;
  color: rgba(255, 255, 255, 0.84);
}

.visitor-vr-exit {
  margin-top: 16px;
  border: 0;
  border-radius: 999px;
  padding: 10px 16px;
  font-weight: 700;
  cursor: pointer;
  color: var(--visitor-color-dark);
  background: rgba(255, 255, 255, 0.96);
}

.visitor-vr-orbit {
  position: absolute;
  inset: 0;
}

.visitor-vr-card {
  position: absolute;
  left: 50%;
  top: 50%;
  width: clamp(120px, 14vw, 180px);
  transform:
    translate(-50%, -50%)
    rotate(var(--vr-angle))
    translateY(calc(-1 * clamp(180px, 23vw, 280px)))
    rotate(calc(-1 * var(--vr-angle)));
  transform-origin: center center;
  animation: vrFloat 6.5s ease-in-out infinite;
  animation-delay: var(--vr-delay);
}

.visitor-vr-image {
  width: 100%;
  aspect-ratio: 3 / 4;
  display: block;
  object-fit: cover;
  border-radius: 18px;
  border: 2px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.25);
}

.visitor-vr-caption {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.9);
  color: var(--visitor-color-dark);
  text-align: center;
  box-shadow: 0 10px 18px rgba(0, 0, 0, 0.16);
}

.visitor-vr-caption strong {
  display: block;
  font-size: 0.86rem;
}

.visitor-vr-caption span {
  display: block;
  margin-top: 4px;
  font-size: 0.76rem;
  color: #52708e;
}

.visitor-vr-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.8);
}

.debug-overlay {
  position: fixed;
  right: 12px;
  top: 12px;
  background: rgba(0,0,0,0.72);
  color: #fff;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  z-index: 20000;
  line-height: 1.3;
  min-width: 220px;
}

@keyframes vrFloat {
  0%, 100% {
    transform:
      translate(-50%, -50%)
      rotate(var(--vr-angle))
      translateY(calc(-1 * clamp(180px, 23vw, 280px)))
      rotate(calc(-1 * var(--vr-angle)))
      translateY(0);
  }
  50% {
    transform:
      translate(-50%, -50%)
      rotate(var(--vr-angle))
      translateY(calc(-1 * clamp(180px, 23vw, 280px)))
      rotate(calc(-1 * var(--vr-angle)))
      translateY(-14px);
  }
}

@media (max-width: 960px) {
  .visitor-gallery-topbar,
  .visitor-gallery-footer,
  .visitor-gallery-heading {
    grid-template-columns: 1fr;
  }

  .visitor-gallery-lead {
    text-align: left;
    max-width: none;
  }

  .visitor-gallery-add {
    justify-self: stretch;
  }

  .visitor-gallery-lightbox-card {
    grid-template-columns: 1fr;
    gap: 12px;
    width: min(720px, calc(100% - 10px));
    min-height: 0;
    padding-top: 48px;
  }

  .visitor-gallery-lightbox-info h3 {
    font-size: 1.4rem;
  }

  .visitor-gallery-lightbox-media {
    height: min(74vh, 600px);
    min-height: min(74vh, 600px);
    width: min(100%, 100%);
  }

  .visitor-gallery-lightbox-video,
  .visitor-gallery-lightbox-video--force {
    transform: translateX(-10px);
  }

  .visitor-topbar-right {
    justify-content: flex-end;
    flex-wrap: wrap;
  }
}

@media (max-width: 640px) {
  .visitor-gallery-shell {
    padding: 14px 12px 12px;
  }

  .visitor-gallery-panel {
    padding: 12px;
  }

  .visitor-gallery-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }

  .visitor-entry-wrap {
    padding: 14px;
  }

  .visitor-entry-card {
    min-height: 0;
    border-radius: 20px;
    padding: 22px 16px;
  }

  .visitor-entry-candle-scene {
    min-height: 124px;
    gap: 12px;
  }

  .visitor-entry-candle.is-large .visitor-entry-candle-wax {
    width: 88px;
    height: 116px;
  }

  .visitor-entry-candle.is-small .visitor-entry-candle-wax {
    width: 66px;
    height: 88px;
  }

  .visitor-gallery-lightbox {
    place-items: end center;
    padding: 0;
  }

  .visitor-gallery-lightbox-card {
    width: 100%;
    min-height: 100vh;
    max-height: 100vh;
    border-radius: 18px 18px 0 0;
    padding: 50px 12px 12px;
    gap: 10px;
    overflow: auto;
  }

  .visitor-gallery-lightbox-close {
    top: 10px;
    right: 10px;
    width: 36px;
    height: 36px;
  }

  .visitor-gallery-lightbox-info {
    order: 2;
    height: auto;
    padding: 12px;
  }

  .visitor-gallery-lightbox-info h3 {
    font-size: 1.16rem;
  }

  .visitor-gallery-lightbox-message {
    min-height: 120px;
  }

  .visitor-gallery-lightbox-media {
    order: 1;
    width: 100%;
    height: min(44vh, 340px);
    min-height: 220px;
    padding: 4px 24px 4px 4px;
  }

  .visitor-gallery-lightbox-next {
    right: 2px;
    font-size: 2rem;
  }

  .visitor-gallery-comment-avatar {
    width: 28px;
    height: 28px;
  }

  .visitor-gallery-comment-bubble {
    margin-left: 38px;
    padding: 10px 12px;
  }
}

@media (max-width: 900px) {
  .visitor-shell {
    gap: 10px;
    padding: 10px 10px calc(116px + env(safe-area-inset-bottom));
  }

  .visitor-stage {
    position: relative;
    min-height: calc(100vh - 260px);
    border-radius: 18px;
    overflow: hidden;
  }

  .visitor-topbar {
    display: grid;
    gap: 8px;
    align-items: start;
  }

  .visitor-topbar h1 {
    font-size: 1.05rem;
    line-height: 1.25;
  }

  .visitor-topbar-right {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: nowrap;
    gap: 8px;
  }

  .visitor-topbar-right > div {
    order: 2;
  }

  .visitor-topbar-right .visitor-user-btn {
    order: 1;
  }

  .visitor-topbar-right .visitor-reactions-btn {
    order: 3;
  }

  .visitor-gallery-topbar .visitor-topbar-right {
    justify-content: flex-end;
  }

  .visitor-gallery-topbar .visitor-topbar-right > div {
    order: 1;
  }

  .visitor-gallery-topbar .visitor-topbar-right .visitor-user-btn {
    order: 2;
    margin-left: 0;
  }

  .visitor-name-btn,
  .visitor-user-btn,
  .visitor-reactions-btn {
    height: 38px;
    font-size: 0.82rem;
  }

  .visitor-name-btn {
    max-width: 52vw;
    padding: 0 12px;
  }

  .visitor-user-btn {
    min-width: 84px;
    padding: 0 12px;
  }

  .visitor-footer {
    position: fixed;
    left: 10px;
    right: 10px;
    bottom: calc(8px + env(safe-area-inset-bottom));
    z-index: 40;
    border-radius: 0;
    border: 0;
    background: transparent;
    backdrop-filter: none;
    box-shadow: none;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    padding: 0;
    align-items: center;
    justify-items: stretch;
  }

  .visitor-gallery-footer {
    position: fixed;
    left: 10px;
    right: 10px;
    bottom: calc(8px + env(safe-area-inset-bottom));
    z-index: 40;
    border-radius: 0;
    border: 0;
    background: transparent;
    backdrop-filter: none;
    box-shadow: none;
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 0;
    align-items: stretch;
  }

  .visitor-footer > .visitor-pill-btn,
  .visitor-gallery-add {
    width: 100%;
    padding: 10px 14px;
    font-size: 0.9rem;
    grid-column: auto;
    justify-self: stretch;
    order: 2;
  }

  .visitor-footer > .visitor-pill-btn {
    width: auto;
    padding: 7px 12px;
    font-size: 0.78rem;
    border-radius: 10px;
    justify-self: start;
  }

  .visitor-action-bar {
    grid-column: auto;
    justify-self: stretch;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
    flex-wrap: nowrap;
    order: 1;
    padding: 0;
    border-radius: 0;
    background: transparent;
    border: 0;
    box-shadow: none;
  }

  .visitor-footer .visitor-action-bar {
    grid-column: 1 / -1;
  }

  .visitor-gallery-tabs {
    grid-column: auto;
    justify-self: stretch;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
    flex-wrap: nowrap;
    order: 1;
    padding: 0;
    border-radius: 0;
    background: transparent;
    border: 0;
    box-shadow: none;
  }

  /* On mobile gallery screens, hide the category menu buttons. */
  .visitor-gallery-footer .visitor-gallery-tabs {
    display: none;
  }

  .visitor-action-btn {
    min-width: 0;
    gap: 6px;
  }

  .visitor-action-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
  }

  .icon-shape {
    width: 28px;
    height: 28px;
  }

  .visitor-action-label {
    font-size: 0.72rem;
    line-height: 1.1;
    text-shadow: none;
    padding: 0;
  }

  .visitor-gallery-footer > .visitor-brand-card,
  .visitor-footer > .visitor-brand-card {
    display: grid;
    justify-self: center;
    min-width: 0;
    padding: 6px 10px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid color-mix(in srgb, var(--brand-dark) 14%, white);
    box-shadow: 0 8px 18px color-mix(in srgb, var(--brand-dark) 14%, transparent);
    order: 3;
  }

  .visitor-footer > .visitor-brand-card {
    grid-column: 2;
    justify-self: end;
    order: 2;
  }

  .visitor-gallery-footer > .visitor-brand-card .visitor-brand-logo,
  .visitor-footer > .visitor-brand-card .visitor-brand-logo {
    max-width: 124px;
    max-height: 32px;
  }

  .visitor-gallery-shell {
    gap: 10px;
    padding: 10px 10px calc(126px + env(safe-area-inset-bottom));
  }

  .visitor-gallery-topbar {
    gap: 8px;
  }

  .visitor-title-card {
    width: 100%;
    min-height: 40px;
    padding: 0 12px;
  }

  .visitor-back-btn-gallery {
    position: static;
    justify-self: start;
    margin-bottom: 6px;
  }

  .visitor-gallery-frame {
    grid-template-columns: 1fr;
    align-content: start;
    gap: 10px;
    padding: 0;
  }

  .visitor-gallery-panel {
    width: 100%;
    min-height: 0;
    max-height: calc(100vh - 320px);
    padding: 10px;
  }

  .visitor-gallery-grid {
    grid-auto-rows: 68px;
  }

  .visitor-gallery-grid.is-media {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .visitor-gallery-candle,
  .visitor-gallery-next,
  .visitor-candles {
    display: none;
  }

  .visitor-vr-entry-btn {
    top: auto;
    right: 14px;
    bottom: calc(122px + env(safe-area-inset-bottom));
    min-width: 86px;
    min-height: 44px;
    padding: 0 14px;
    font-size: 0.92rem;
  }

  .visitor-room-reaction-panel {
    left: 10px;
    right: 10px;
    top: auto;
    bottom: calc(126px + env(safe-area-inset-bottom));
    width: auto;
    max-width: none;
    max-height: min(66vh, 520px);
    border-radius: 16px;
    padding: 46px 12px 12px;
  }

  .visitor-panel {
    left: 10px;
    right: 10px;
    bottom: calc(126px + env(safe-area-inset-bottom));
    transform: none;
    width: auto;
    max-height: min(66vh, 560px);
    border-radius: 16px;
  }

  .visitor-panel--side,
  .visitor-panel--side-right {
    left: 10px;
    right: 10px;
    top: auto;
    bottom: calc(126px + env(safe-area-inset-bottom));
    width: auto;
    height: auto;
    max-height: min(66vh, 560px);
    border-radius: 16px;
  }

  .visitor-panel--candle-detail {
    top: auto;
    bottom: calc(126px + env(safe-area-inset-bottom));
    left: 10px;
    right: 10px;
    width: auto;
    max-height: min(66vh, 560px);
    transform: none;
    padding-bottom: 78px;
  }

  .candle-panel-footer {
    left: 12px;
    right: 12px;
    bottom: -62px;
  }

  .item-comment-form {
    grid-template-columns: 1fr;
  }

  .item-comment-form {
    grid-template-columns: 1fr;
  }
}
</style>
