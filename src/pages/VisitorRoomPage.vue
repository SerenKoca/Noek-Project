<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ThreeScene from '../components/ThreeScene.vue'
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

const VISITOR_NAME_STORAGE = 'noek_visitor_name'
const VISITOR_ENTRY_STORAGE = 'noek_visitor_entry_seen'
const VISITOR_BRAND_STORAGE = 'noek_visitor_brand'

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

  if (activePanel.value === 'photos') return items.filter((item) => item.type === 'photo')
  if (activePanel.value === 'music') return items.filter((item) => item.type === 'music_url')
  if (activePanel.value === 'videos') return items.filter((item) => item.type === 'video_file' || item.type === 'video_url')
  if (activePanel.value === 'candles') return items.filter((item) => item.type === 'candle')
  return items
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

function loadBrandSettings() {
  if (typeof window === 'undefined') return
  try {
    const parsed = JSON.parse(window.localStorage.getItem(VISITOR_BRAND_STORAGE) || '{}')
    logoTitle.value = String(parsed?.logoTitle || logoTitle.value).trim() || 'Thibaut DELA'
    logoSubtitle.value = String(parsed?.logoSubtitle || logoSubtitle.value).trim() || 'Uitvaartzorg'
  } catch {
    // keep defaults
  }
}

function persistBrandSettings() {
  if (typeof window === 'undefined') return
  const payload = {
    logoTitle: String(logoTitle.value || '').trim() || 'Thibaut DELA',
    logoSubtitle: String(logoSubtitle.value || '').trim() || 'Uitvaartzorg'
  }
  window.localStorage.setItem(VISITOR_BRAND_STORAGE, JSON.stringify(payload))
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

  loadBrandSettings()
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
    } catch {
      error.value = 'Kon kamer niet laden.'
    }
  }
})

watch([logoTitle, logoSubtitle], persistBrandSettings)
watch(roomId, () => {
  hasEnteredRoom.value = readStoredEntryState(roomId.value)
  activePanel.value = 'none'
})

onBeforeUnmount(() => {
  stopRoomAudio()
})
</script>

<template>
  <div class="visitor-page-v3">
    <div v-if="!hasEnteredRoom" class="visitor-entry-wrap">
      <div class="visitor-entry-card">
        <div class="visitor-entry-logo">???</div>
        <p class="visitor-entry-copy">
          Je betreedt {{ roomTitle }}.<br>
          Waar herinneringen blijven voortleven.
        </p>
        <button type="button" class="visitor-pill-btn" :disabled="introLoading" @click="enterRoom">
          {{ introLoading ? 'Herinneringen worden geladen ...' : 'Stap binnen' }}
        </button>
      </div>
    </div>

    <div v-else class="visitor-shell">
      <header class="visitor-topbar">
        <h1>{{ roomTitle }}</h1>
        <div class="visitor-topbar-right">
          <button type="button" class="visitor-name-btn" @click="applyVisitorName">
            <span>{{ visitorName || 'Naam' }}</span>
            <span class="visitor-edit">?</span>
          </button>
          <button type="button" class="visitor-user-btn" @click="isLoggedIn ? openProfile() : openLogin()">??</button>
        </div>
      </header>

      <main class="visitor-stage">
        <div class="visitor-scene-frame" v-if="!loading && !error && room">
          <ThreeScene class="visitor-scene" :room-data="roomSceneData" />
        </div>
        <div v-else-if="loading" class="visitor-status">Kamer laden...</div>
        <div v-else class="visitor-status error">{{ error }}</div>

        <div class="visitor-candles left">??????</div>
        <div class="visitor-candles right">??????</div>
      </main>

      <footer class="visitor-footer">
        <button type="button" class="visitor-pill-btn" @click="openContributionPanel('tutorial')">Tutorial volgen</button>

        <div class="visitor-action-bar">
          <button type="button" :class="['visitor-action-btn', { active: activePanel === 'photos' }]" @click="openContributionPanel('photos')">Foto's</button>
          <button type="button" :class="['visitor-action-btn', { active: activePanel === 'music' }]" @click="openContributionPanel('music')">Muziek</button>
          <button type="button" :class="['visitor-action-btn', { active: activePanel === 'videos' }]" @click="openContributionPanel('videos')">Video's</button>
          <button type="button" :class="['visitor-action-btn', { active: activePanel === 'candles' }]" @click="openContributionPanel('candles')">Kaarsjes</button>
          <button type="button" :class="['visitor-action-btn', { active: activePanel === 'messages' }]" @click="openContributionPanel('messages')">Bericht</button>
        </div>

        <div class="visitor-brand-card">
          <strong>{{ logoTitle }}</strong>
          <span>{{ logoSubtitle }}</span>
        </div>
      </footer>

      <section v-if="activePanel !== 'none'" class="visitor-panel">
        <div class="visitor-panel-head">
          <strong>{{ panelTitle }}</strong>
          <button type="button" class="visitor-close" @click="closePanel">?</button>
        </div>

        <div class="visitor-panel-body">
          <template v-if="activePanel === 'tutorial'">
            <p>1. Kies onderaan een type bijdrage.</p>
            <p>2. Voeg tekst/foto/video/muziek toe en druk op opslaan.</p>
            <p>3. Reageer met comments of reacties op bestaande bijdragen.</p>
            <hr>
            <h4>Logo instellingen</h4>
            <label class="panel-field">
              <span>Logo titel</span>
              <input v-model="logoTitle" type="text" maxlength="40">
            </label>
            <label class="panel-field">
              <span>Logo subtitel</span>
              <input v-model="logoSubtitle" type="text" maxlength="40">
            </label>
            <div class="roomMusicLine">
              <button type="button" class="visitor-pill-btn" @click="enableRoomSound">Geluid afspelen</button>
              <span v-if="roomMusicState.playing">Kamergeluid speelt</span>
              <span v-else-if="roomMusicState.error">{{ roomMusicState.error }}</span>
            </div>
          </template>

          <template v-else-if="activePanel === 'messages'">
            <div class="item-reactions-row">
              <button type="button" class="reaction-chip" @click="toggleRoomReaction('heart')">?? {{ room?.roomReactions?.heartCount || 0 }}</button>
              <button type="button" class="reaction-chip" @click="toggleRoomReaction('support')">?? {{ room?.roomReactions?.supportCount || 0 }}</button>
              <button type="button" class="reaction-chip" @click="toggleRoomReaction('candle')">??? {{ room?.roomReactions?.candleCount || 0 }}</button>
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
                  <button type="button" class="reaction-chip" @click="toggleContributionReaction(item._id, 'heart')">?? {{ item.reactions?.heartCount || 0 }}</button>
                  <button type="button" class="reaction-chip" @click="toggleContributionReaction(item._id, 'support')">?? {{ item.reactions?.supportCount || 0 }}</button>
                  <button type="button" class="reaction-chip" @click="toggleContributionReaction(item._id, 'candle')">??? {{ item.reactions?.candleCount || 0 }}</button>
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
