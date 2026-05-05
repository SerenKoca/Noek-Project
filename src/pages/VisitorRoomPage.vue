<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
const roomMode = ref('room')
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
const tributeText = ref('')
const type = ref('candle')
const externalUrl = ref('')
const mediaUrl = ref('')
const roomCommentText = ref('')
const mediaFile = ref(null)

const logoTitle = ref('Thibaut DELA')
const logoSubtitle = ref('Uitvaartzorg')
const brandLogoUrl = ref('')

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
    candles: 'Kaarsjes',
    messages: 'Bericht',
    tutorial: 'Tutorial'
  }
  return map[activePanel.value] || 'Paneel'
})

const filteredContributions = computed(() => {
  const items = Array.isArray(contributions.value) ? contributions.value : []

  if (selectedCategory.value === 'photos') return items.filter((item) => item.type === 'photo')
  if (selectedCategory.value === 'music') return items.filter((item) => item.type === 'music_url')
  if (selectedCategory.value === 'videos') return items.filter((item) => item.type === 'video_file' || item.type === 'video_url')
  return items
})

const roomPhotoItems = computed(() => {
  const items = Array.isArray(contributions.value) ? contributions.value : []
  return items.filter((item) => item.type === 'photo' && item.mediaUrl).slice(0, 12)
})

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

function exitVrMode() {
  galleryMode.value = 'gallery'
}

function enterRoomVrMode() {
  roomMode.value = 'vr'
}

function exitRoomVrMode() {
  roomMode.value = 'room'
}

function openGalleryComposer() {
  const category = selectedCategory.value || 'photos'
  openContributionPanel(category)
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
  activePanel.value = panel
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
  roomMusicState.value = { loading: true, error: '', playing: false }

  try {
    await audioPlayer.value.play()
    roomMusicState.value = { loading: false, error: '', playing: true }
  } catch {
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
  } catch (err) {
    error.value = err?.response?.data?.error || 'Kon kamer niet laden.'
  } finally {
    loading.value = false
  }
}

async function enterRoom() {
  introLoading.value = true
  hasEnteredRoom.value = true
  persistEntryState(roomId.value)

  try {
    await loadAll()
    await startRoomAudioFromRoom(room.value)
  } finally {
    introLoading.value = false
  }
}

async function openLogin() {
  await router.push('/login')
}

async function openProfile() {
  if (!isLoggedIn.value) {
    profileHint.value = 'Inloggen is optioneel, maar nodig om je bijdragen in profiel te zien.'
    return
  }
  await router.push('/profile')
}

function onMediaFileChange(event) {
  mediaFile.value = event?.target?.files?.[0] || null
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

    await createPublicRoomContribution(roomId.value, {
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

    await loadAll()
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
  } catch {
    // noop
  }
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
})

watch(roomId, () => {
  hasEnteredRoom.value = readStoredEntryState(roomId.value)
  activePanel.value = 'none'
})

watch(selectedCategory, () => {
  activePanel.value = 'none'
  galleryMode.value = 'gallery'
  roomMode.value = 'room'
})

onBeforeUnmount(() => {
  stopRoomAudio()
})
</script>

<template>
  <div class="visitor-page-v3">
    <div v-if="!hasEnteredRoom" class="visitor-entry-wrap">
      <div class="visitor-entry-card">
        <div class="visitor-entry-logo">{{ roomTitle.charAt(0) || 'N' }}</div>
        <p class="visitor-entry-copy">
          Je betreedt {{ roomTitle }}.<br>
          Waar herinneringen blijven voortleven.
        </p>
        <button type="button" class="visitor-pill-btn" :disabled="introLoading" @click="enterRoom">
          {{ introLoading ? 'Herinneringen worden geladen...' : 'Stap binnen' }}
        </button>
      </div>
    </div>

    <div v-else-if="isGalleryPage" class="visitor-gallery-shell" :class="{ 'vr-mode-active': isVrMode }">
      <header v-if="!isVrMode" class="visitor-gallery-topbar">
        <button type="button" class="visitor-back-btn" @click="goToOverview">← Terug</button>

        <div class="visitor-title-card">
          <h1>{{ roomTitle }}</h1>
        </div>

        <div class="visitor-topbar-right">
          <button type="button" class="visitor-name-btn" @click="applyVisitorName">
            <span>{{ visitorName || 'Naam' }}</span>
            <span class="visitor-edit">✎</span>
          </button>
          <button type="button" class="visitor-user-btn" @click="isLoggedIn ? openProfile() : openLogin()">
            {{ isLoggedIn ? 'Profiel' : 'Inloggen' }}
          </button>
        </div>
      </header>

      <main class="visitor-gallery-main" :class="{ 'is-vr': isVrMode }">
        <section v-if="!isVrMode" class="visitor-gallery-panel">
          <div class="visitor-gallery-heading">
            <div>
              <p class="visitor-gallery-kicker">{{ galleryCategoryLabel }}</p>
              <h2>{{ galleryHeading }}</h2>
            </div>
            <p class="visitor-gallery-lead">{{ galleryLead }}</p>
          </div>

          <div v-if="loading" class="visitor-status">Kamer laden...</div>
          <div v-else-if="error" class="visitor-status error">{{ error }}</div>
          <template v-else>
            <div v-if="filteredContributions.length" class="visitor-gallery-grid">
              <article v-for="item in filteredContributions" :key="item._id" class="visitor-gallery-card">
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

                <div class="visitor-gallery-copy">
                  <strong>{{ item.giverName || 'Bezoeker' }}</strong>
                  <p>{{ item.tributeText || ' ' }}</p>
                </div>
              </article>
            </div>
            <p v-else class="visitor-gallery-empty">Nog geen bijdragen in deze categorie.</p>
          </template>
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

      <button v-if="!showVrToggle" type="button" class="visitor-gallery-add" @click="openGalleryComposer">
        {{ galleryActionLabel }}
      </button>

      <footer v-if="!isVrMode" class="visitor-gallery-footer">
        <div class="visitor-gallery-tabs">
          <button type="button" :class="['visitor-gallery-tab', { active: selectedCategory === 'photos' }]" @click="goToGallery('photos')">Foto's</button>
          <button type="button" :class="['visitor-gallery-tab', { active: selectedCategory === 'music' }]" @click="goToGallery('music')">Muziek</button>
          <button type="button" :class="['visitor-gallery-tab', { active: selectedCategory === 'videos' }]" @click="goToGallery('videos')">Video's</button>
          <button type="button" :class="['visitor-gallery-tab', { active: activePanel === 'candles' }]" @click="openContributionPanel('candles')">Kaarsjes</button>
          <button type="button" :class="['visitor-gallery-tab', { active: activePanel === 'messages' }]" @click="openContributionPanel('messages')">Bericht</button>
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
          <button type="button" class="visitor-name-btn" @click="applyVisitorName">
            <span>{{ visitorName || 'Naam' }}</span>
            <span class="visitor-edit">✎</span>
          </button>
          <button type="button" class="visitor-user-btn" @click="isLoggedIn ? openProfile() : openLogin()">
            {{ isLoggedIn ? 'Profiel' : 'Inloggen' }}
          </button>
        </div>
      </header>

      <main class="visitor-stage">
        <div v-if="!loading && !error && room" class="visitor-scene-frame">
          <ThreeScene class="visitor-scene" :room-data="roomSceneData" />
        </div>
        <div v-else-if="loading" class="visitor-status">Kamer laden...</div>
        <div v-else class="visitor-status error">{{ error }}</div>

        <div class="visitor-candles left">🕯</div>
        <div class="visitor-candles right">🕯</div>
      </main>

      <footer class="visitor-footer">
        <button type="button" class="visitor-pill-btn" @click="openContributionPanel('tutorial')">Tutorial volgen</button>

        <div class="visitor-action-bar">
          <button type="button" :class="['visitor-action-btn', { active: selectedCategory === 'photos' }]" @click="goToGallery('photos')">Foto's</button>
          <button type="button" :class="['visitor-action-btn', { active: selectedCategory === 'music' }]" @click="goToGallery('music')">Muziek</button>
          <button type="button" :class="['visitor-action-btn', { active: selectedCategory === 'videos' }]" @click="goToGallery('videos')">Video's</button>
          <button type="button" :class="['visitor-action-btn', { active: activePanel === 'candles' }]" @click="openContributionPanel('candles')">Kaarsjes</button>
          <button type="button" :class="['visitor-action-btn', { active: activePanel === 'messages' }]" @click="openContributionPanel('messages')">Bericht</button>
        </div>

        <div class="visitor-brand-card">
          <img v-if="brandLogoUrl" :src="brandLogoUrl" alt="Brand logo" class="visitor-brand-logo" />
          <strong>{{ logoTitle }}</strong>
          <span>{{ logoSubtitle }}</span>
        </div>
      </footer>

      <section v-if="activePanel !== 'none'" class="visitor-panel">
        <div class="visitor-panel-head">
          <strong>{{ panelTitle }}</strong>
          <button type="button" class="visitor-close" @click="closePanel">×</button>
        </div>

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

          <template v-else-if="activePanel === 'messages'">
            <div class="item-reactions-row">
              <button type="button" class="reaction-chip" @click="toggleRoomReaction('heart')">Hart {{ room?.roomReactions?.heartCount || 0 }}</button>
              <button type="button" class="reaction-chip" @click="toggleRoomReaction('support')">Steun {{ room?.roomReactions?.supportCount || 0 }}</button>
              <button type="button" class="reaction-chip" @click="toggleRoomReaction('candle')">Kaars {{ room?.roomReactions?.candleCount || 0 }}</button>
            </div>
            <form class="item-comment-form" @submit.prevent="postRoomComment">
              <input v-model="roomCommentText" type="text" maxlength="500" placeholder="Laat een reactie achter voor deze kamer">
              <button type="submit" class="visitor-pill-btn">Plaats reactie</button>
            </form>
            <ul class="item-comments-items" v-if="room?.roomComments?.length">
              <li v-for="comment in room.roomComments" :key="comment._id || comment.createdAt" class="item-comment-entry">
                <span class="item-comment-author">{{ comment.displayName || 'Bezoeker' }}:</span>
                <span>{{ comment.text }}</span>
              </li>
            </ul>
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
                  <button type="button" class="reaction-chip" @click="toggleContributionReaction(item._id, 'heart')">Hart {{ item.reactions?.heartCount || 0 }}</button>
                  <button type="button" class="reaction-chip" @click="toggleContributionReaction(item._id, 'support')">Steun {{ item.reactions?.supportCount || 0 }}</button>
                  <button type="button" class="reaction-chip" @click="toggleContributionReaction(item._id, 'candle')">Kaars {{ item.reactions?.candleCount || 0 }}</button>
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
      </section>

      <p v-if="profileHint" class="visitor-profile-hint">{{ profileHint }}</p>
    </div>
  </div>
</template>

<style scoped>
.visitor-page-v3 {
  --visitor-color-dark: var(--editor-panel-strong);
  --visitor-color-light: var(--editor-bg-shell-bottom);
  --visitor-ink: var(--editor-text);
  --visitor-soft: color-mix(in srgb, var(--editor-bg-shell-bottom) 24%, transparent);
  --visitor-soft-2: color-mix(in srgb, var(--editor-bg-shell-bottom) 42%, transparent);
  --visitor-card: rgba(255, 255, 255, 0.88);
  --visitor-border: color-mix(in srgb, var(--editor-panel-strong) 24%, transparent);
  --visitor-btn-text: #ffffff;
  min-height: 100vh;
  background: linear-gradient(180deg, var(--editor-bg-shell-top) 0%, var(--editor-bg-shell-mid) 58%, var(--editor-bg-shell-bottom) 100%);
  color: var(--visitor-ink);
  padding: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.visitor-entry-wrap {
  height: 100%;
  display: grid;
  place-items: center;
  padding: 24px;
  box-sizing: border-box;
  overflow: hidden;
}

.visitor-entry-card {
  width: min(660px, 100%);
  min-height: 360px;
  border-radius: 18px;
  background: var(--visitor-card);
  border: 1px solid var(--visitor-border);
  box-shadow: 0 18px 44px rgba(11, 63, 116, 0.16);
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 18px;
  text-align: center;
  padding: 26px;
}

.visitor-brand-logo {
  max-width: 160px;
  max-height: 44px;
  object-fit: contain;
}

.visitor-entry-logo {
  font-size: 56px;
}

.visitor-entry-copy {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.6;
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
  font-size: clamp(1.4rem, 2.6vw, 2.2rem);
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
  border: 1px solid var(--visitor-border);
  background: var(--visitor-card);
  border-radius: 999px;
  color: var(--visitor-color-dark);
  height: 44px;
  cursor: pointer;
}

.visitor-name-btn {
  padding: 0 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
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
  grid-template-columns: auto 1fr auto;
  gap: 16px;
  align-items: end;
}

.visitor-pill-btn {
  pointer-events: auto;
  border: 0;
  background: linear-gradient(90deg, var(--visitor-color-dark), var(--visitor-color-light));
  color: var(--visitor-btn-text);
  border-radius: 14px;
  padding: 10px 18px;
  font-weight: 600;
  cursor: pointer;
}

.visitor-action-bar {
  pointer-events: auto;
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.visitor-action-btn {
  min-width: 98px;
  border: 1px solid var(--visitor-border);
  border-radius: 10px;
  background: var(--visitor-card);
  color: var(--visitor-color-dark);
  padding: 12px 14px;
  cursor: pointer;
  font-weight: 600;
}

.visitor-action-btn.active {
  background: linear-gradient(180deg, #ffffff, var(--visitor-soft));
  border-color: var(--visitor-color-dark);
}

.visitor-brand-card {
  pointer-events: auto;
  border: 1px solid var(--visitor-border);
  border-radius: 10px;
  background: var(--visitor-card);
  padding: 10px 12px;
  min-width: 150px;
  display: grid;
  color: var(--visitor-color-dark);
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
  padding: 6px 10px;
  cursor: pointer;
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
  gap: 14px;
  padding: 18px 16px 16px;
  box-sizing: border-box;
  background:
    radial-gradient(circle at 10% 12%, rgba(255, 255, 255, 0.24), transparent 22%),
    radial-gradient(circle at 88% 18%, rgba(255, 255, 255, 0.18), transparent 20%),
    linear-gradient(180deg, var(--editor-bg-shell-top) 0%, var(--editor-bg-shell-mid) 54%, var(--editor-bg-shell-bottom) 100%);
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
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
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
  font-size: clamp(1.15rem, 2.2vw, 1.65rem);
  line-height: 1;
}

.visitor-gallery-main {
  display: grid;
  place-items: center;
  min-height: 0;
}

.visitor-gallery-main.is-vr {
  place-items: stretch;
  padding: 0;
  background: #0d1820;
}

.visitor-gallery-panel {
  width: min(980px, 100%);
  min-height: 100%;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 20px 52px rgba(11, 63, 116, 0.18);
  padding: 14px;
  display: grid;
  gap: 14px;
  box-sizing: border-box;
}

.visitor-gallery-heading {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: end;
}

.visitor-gallery-kicker {
  margin: 0 0 4px;
  color: #4f7598;
  font-size: 0.86rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.visitor-gallery-heading h2 {
  margin: 0;
  color: var(--visitor-color-dark);
  font-size: clamp(1.15rem, 2.6vw, 1.8rem);
}

.visitor-gallery-lead {
  margin: 0;
  max-width: 360px;
  color: #52708e;
  line-height: 1.45;
  font-size: 0.95rem;
  text-align: right;
}

.visitor-gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.visitor-gallery-card {
  display: grid;
  gap: 8px;
}

.visitor-gallery-media {
  aspect-ratio: 1 / 1.15;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(221, 232, 242, 0.9), rgba(201, 218, 235, 0.95));
  border: 1px solid rgba(18, 58, 98, 0.12);
  box-shadow: 0 8px 20px rgba(11, 63, 116, 0.08);
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
  min-height: 100%;
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
  color: #50708e;
  font-size: 0.88rem;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.visitor-gallery-empty {
  margin: 0;
  color: #50708e;
}

.visitor-gallery-add {
  justify-self: start;
  border: 0;
  border-radius: 14px;
  padding: 12px 18px;
  font-weight: 700;
  background: linear-gradient(90deg, var(--visitor-color-dark), var(--visitor-color-light));
  color: #fff;
  box-shadow: 0 12px 26px rgba(11, 63, 116, 0.18);
  cursor: pointer;
}

.visitor-vr-entry-btn {
  position: absolute;
  top: 84px;
  right: 16px;
  z-index: 3;
}

.visitor-gallery-footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
}

.visitor-gallery-footer-vr {
  grid-template-columns: minmax(0, 1fr) auto;
}

.visitor-gallery-tabs {
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.visitor-gallery-tab {
  border: 1px solid rgba(18, 58, 98, 0.16);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  color: var(--visitor-color-dark);
  padding: 10px 14px;
  min-width: 88px;
  font-weight: 700;
  cursor: pointer;
}

.visitor-gallery-tab.active {
  background: linear-gradient(180deg, #ffffff, rgba(255, 255, 255, 0.72));
  border-color: var(--visitor-color-dark);
}

.visitor-vr-stage {
  position: relative;
  min-height: min(72vh, 760px);
  width: min(980px, 100%);
  margin: 0 auto;
  border-radius: 22px;
  overflow: hidden;
  background:
    radial-gradient(circle at center, rgba(255, 255, 255, 0.18), transparent 18%),
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.08), transparent 42%),
    linear-gradient(180deg, rgba(11, 52, 89, 0.95), rgba(28, 85, 132, 0.96));
  border: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow: 0 24px 64px rgba(11, 63, 116, 0.28);
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
}

@media (max-width: 900px) {
  .visitor-shell {
    padding: 14px 10px 12px;
  }

  .visitor-footer {
    grid-template-columns: 1fr;
    justify-items: stretch;
  }

  .visitor-candles {
    display: none;
  }

  .visitor-action-bar {
    justify-content: flex-start;
  }

  .visitor-action-btn {
    flex: 1;
    min-width: 120px;
  }

  .item-comment-form {
    grid-template-columns: 1fr;
  }
}
</style>
