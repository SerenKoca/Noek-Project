<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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

const route = useRoute()
const router = useRouter()
const roomId = computed(() => String(route.params.id || ''))

const room = ref(null)
const contributions = ref([])
const loading = ref(true)
const error = ref('')
const submitState = ref({ loading: false, error: '', success: '' })
const profileHint = ref('')
const hasEnteredRoom = ref(false)
const introLoading = ref(false)
const commentDrafts = ref({})
const commentStateByItem = ref({})
const audioPlayer = ref(null)
const roomMusicState = ref({ loading: false, error: '', playing: false })

const auth = ref(getStoredAuth())
const isLoggedIn = computed(() => Boolean(auth.value?.token))
const authDisplayName = computed(() => {
  const fromProfile = String(auth.value?.user?.displayName || '').trim()
  if (fromProfile) return fromProfile

  const fromEmail = String(auth.value?.user?.email || '').trim()
  if (!fromEmail) return ''

  const [namePart] = fromEmail.split('@')
  return namePart || ''
})

const visitorName = ref('')
const tributeText = ref('')
const type = ref('candle')
const externalUrl = ref('')
const mediaUrl = ref('')
const roomCommentText = ref('')
const mediaFile = ref(null)
const roomSceneData = computed(() => room.value?.sceneData || null)
const roomReactionTotal = computed(() => {
  const reactions = room.value?.roomReactions || {}
  return Number(reactions.heartCount || 0) + Number(reactions.supportCount || 0) + Number(reactions.candleCount || 0)
})

const roomContributionCount = computed(() => Array.isArray(contributions.value) ? contributions.value.length : 0)

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

    if (host === 'youtu.be') {
      return url.pathname.split('/').filter(Boolean)[0] || ''
    }

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
    if (parts.length >= 2) {
      return `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`
    }
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
  if (isAudioUrl(input)) return 'none'
  return 'none'
}

function stopRoomAudio() {
  if (!audioPlayer.value) return
  audioPlayer.value.pause()
  audioPlayer.value.src = ''
  roomMusicState.value = { loading: false, error: '', playing: false }
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
  roomMusicState.value = { loading: true, error: '', playing: false }

  try {
    await audioPlayer.value.play()
    roomMusicState.value = { loading: false, error: '', playing: true }
  } catch {
    roomMusicState.value = {
      loading: false,
      error: 'Geluid kon niet automatisch starten. Klik op de knop om het af te spelen.',
      playing: false
    }
  }
}

async function enableRoomSound() {
  await startRoomAudioFromRoom(room.value)
}

function readStoredVisitorName() {
  if (typeof window === 'undefined') return ''
  return String(window.localStorage.getItem(VISITOR_NAME_STORAGE) || '').trim()
}

function readStoredEntryState(roomIdValue) {
  if (typeof window === 'undefined' || !roomIdValue) return false

  try {
    const raw = window.localStorage.getItem(VISITOR_ENTRY_STORAGE)
    const parsed = raw ? JSON.parse(raw) : {}
    return Boolean(parsed?.[roomIdValue])
  } catch {
    return false
  }
}

function persistEntryState(roomIdValue) {
  if (typeof window === 'undefined' || !roomIdValue) return

  try {
    const raw = window.localStorage.getItem(VISITOR_ENTRY_STORAGE)
    const parsed = raw ? JSON.parse(raw) : {}
    parsed[roomIdValue] = true
    window.localStorage.setItem(VISITOR_ENTRY_STORAGE, JSON.stringify(parsed))
  } catch {
    window.localStorage.setItem(VISITOR_ENTRY_STORAGE, JSON.stringify({ [roomIdValue]: true }))
  }
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

function ensureVisitorNameInitialized() {
  const saved = readStoredVisitorName()
  if (saved) {
    visitorName.value = saved
    return
  }

  visitorName.value = authDisplayName.value || 'Bezoeker'
  persistVisitorName(visitorName.value)
}

function ensureVisitorEntryState() {
  hasEnteredRoom.value = readStoredEntryState(roomId.value)
}

function applyVisitorName() {
  const trimmed = String(visitorName.value || '').trim()
  if (!trimmed) {
    visitorName.value = authDisplayName.value || 'Bezoeker'
  } else {
    visitorName.value = trimmed
  }

  persistVisitorName(visitorName.value)
}

async function openLogin() {
  await router.push('/login')
}

async function openProfile() {
  if (!isLoggedIn.value) {
    profileHint.value = 'Inloggen is optioneel, maar nodig om je persoonlijke bijdragen in profiel te zien.'
    return
  }

  await router.push('/profile')
}

async function enterRoom() {
  introLoading.value = true
  persistEntryState(roomId.value)
  hasEnteredRoom.value = true

  try {
    await loadAll()
    await startRoomAudioFromRoom(room.value)
  } finally {
    introLoading.value = false
  }
}

function onMediaFileChange(event) {
  mediaFile.value = event?.target?.files?.[0] || null
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

onMounted(ensureVisitorEntryState)
onMounted(ensureVisitorNameInitialized)

onMounted(() => {
  if (!hasEnteredRoom.value) return
  if (room.value) {
    startRoomAudioFromRoom(room.value)
  }
})

onMounted(async () => {
  if (hasEnteredRoom.value) {
    await loadAll()
    await startRoomAudioFromRoom(room.value)
  } else {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  stopRoomAudio()
})

async function addContribution() {
  submitState.value = { loading: true, error: '', success: '' }
  try {
    applyVisitorName()

    let nextMediaUrl = mediaUrl.value

    if (type.value === 'photo' || type.value === 'video_file') {
      if (mediaFile.value) {
        const resourceType = type.value === 'photo' ? 'image' : 'video'
        const uploadResult = await uploadToCloudinary(mediaFile.value, resourceType)
        nextMediaUrl = uploadResult.secure_url || ''
      }
    }

    await createPublicRoomContribution(roomId.value, {
      type: type.value,
      giverName: visitorName.value,
      tributeText: tributeText.value,
      externalUrl: externalUrl.value,
      mediaUrl: nextMediaUrl,
      platform:
        type.value === 'music_url'
          ? resolveMusicPlatform(externalUrl.value)
          : type.value === 'video_url'
            ? (getYouTubeEmbedUrl(externalUrl.value) ? 'youtube' : 'none')
            : 'none'
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
    // ignore in UI for now
  }
}

async function toggleRoomReaction(kind) {
  try {
    room.value = await reactToPublicRoom(roomId.value, kind)
  } catch {
    // ignore in UI for now
  }
}

async function toggleContributionReaction(contributionId, kind) {
  try {
    const updated = await reactToPublicRoomContribution(roomId.value, contributionId, kind)
    contributions.value = contributions.value.map((row) => (row._id === updated._id ? updated : row))
  } catch {
    // ignore in UI for now
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
</script>

<template>
  <div class="editor-page is-home">
    <div class="settings-page-v2">
      <header class="settings-header-v2">
        <div class="settings-header-center-v2">
          <div class="settings-step-v2">Publieke kamer</div>
          <h2>{{ room?.name || 'Kamer bekijken' }}</h2>
          <p class="visitor-room-subtitle">
            Bekijk de kamer, voeg een herinnering toe of reageer op wat anderen al hebben gedeeld.
          </p>
        </div>
      </header>

      <section v-if="!hasEnteredRoom" class="visitor-entry-screen">
        <div class="visitor-entry-card">
          <img class="visitor-entry-logo" src="/favicon.ico" alt="Noek" />
          <p class="visitor-entry-copy">
            Je betreedt {{ room?.name || 'de digitale herdenkingsruimte' }}.
            Waar herinneringen blijven voortleven.
          </p>
          <button type="button" class="primary-btn visitor-entry-btn" :disabled="introLoading" @click="enterRoom">
            {{ introLoading ? 'Herinneringen worden geladen ...' : 'Stap binnen' }}
          </button>
        </div>
      </section>

      <section class="visitor-room-hero" v-if="room && hasEnteredRoom">
        <div class="visitor-room-hero-copy">
          <span class="role-badge visitor-room-badge">bezoeker</span>
          <h3>Welkom in deze kamer</h3>
          <p>
            Je kan de kamer bekijken, bijdragen toevoegen en reageren zonder editorrechten.
          </p>
          <div class="visitor-room-sound-status" v-if="roomMusicState.loading || roomMusicState.playing || roomMusicState.error">
            <span v-if="roomMusicState.loading">Geluid laden...</span>
            <span v-else-if="roomMusicState.playing">Geluid van de kamer speelt af</span>
            <button v-else-if="roomMusicState.error" type="button" class="secondary-btn" @click="enableRoomSound">Geluid afspelen</button>
          </div>
          <p v-if="roomMusicState.error" class="visitor-room-note">{{ roomMusicState.error }}</p>
        </div>
        <div class="visitor-room-stats">
          <div class="visitor-room-stat">
            <strong>{{ roomContributionCount }}</strong>
            <span>Bijdragen</span>
          </div>
          <div class="visitor-room-stat">
            <strong>{{ roomReactionTotal }}</strong>
            <span>Reacties</span>
          </div>
          <div class="visitor-room-stat">
            <strong>{{ room?.roomComments?.length || 0 }}</strong>
            <span>Kamerreacties</span>
          </div>
        </div>
      </section>

      <section class="visitor-identity-panel" v-if="!loading && !error && hasEnteredRoom">
        <div class="visitor-identity-left">
          <h3>Jouw bezoekersnaam</h3>
          <p>Deze naam tonen we bij je reacties en bijdragen in deze kamer.</p>
          <div class="visitor-identity-input-row">
            <input
              v-model="visitorName"
              type="text"
              maxlength="80"
              placeholder="Kies een naam"
              @blur="applyVisitorName"
            />
            <button type="button" class="secondary-btn" @click="applyVisitorName">Opslaan</button>
          </div>
        </div>

        <div class="visitor-identity-right">
          <button v-if="!isLoggedIn" type="button" class="primary-btn" @click="openLogin">Inloggen als bezoeker</button>
          <button v-else type="button" class="primary-btn" @click="openProfile">Naar profielinstellingen</button>
          <p class="visitor-identity-note">
            Inloggen is niet verplicht. Zonder login kan je nog steeds alles posten, maar met login zie je je bijdragen ook in profiel.
          </p>
          <p v-if="profileHint" class="room-contribution-empty error">{{ profileHint }}</p>
        </div>
      </section>

      <section class="visitor-room-scene-shell" v-if="room && hasEnteredRoom">
        <div class="editor-scene-panel visitor-room-scene-panel">
          <ThreeScene class="editor-scene visitor-room-scene" :room-data="roomSceneData" />
        </div>
      </section>

      <section class="settings-content-v2" v-if="!loading && !error && room && hasEnteredRoom">
        <div class="settings-left-v2">
          <h3>Bijdrage plaatsen</h3>
          <p class="visitor-room-note">Foto/video uploaden werkt hier zoals in de editor: kies bestand of gebruik een URL.</p>
          <label class="auth-field-v2">
            <span>Type</span>
            <select v-model="type">
              <option value="candle">Kaarsje</option>
              <option value="music_url">Muzieklink</option>
              <option value="video_url">Videolink</option>
              <option value="photo">Foto (bestand of URL)</option>
              <option value="video_file">Video (bestand of URL)</option>
            </select>
          </label>
          <input v-if="type === 'music_url' || type === 'video_url'" v-model="externalUrl" type="url" placeholder="Externe URL" />
          <input v-if="type === 'photo' || type === 'video_file'" v-model="mediaUrl" type="url" placeholder="Media URL (optioneel als je uploadt)" />
          <input
            v-if="type === 'photo' || type === 'video_file'"
            type="file"
            :accept="type === 'photo' ? 'image/*' : 'video/*'"
            @change="onMediaFileChange"
          />
          <textarea v-model="tributeText" rows="3" placeholder="Jouw bericht" />
          <button type="button" class="primary-btn" :disabled="submitState.loading" @click="addContribution">
            {{ submitState.loading ? 'Opslaan...' : 'Toevoegen' }}
          </button>
          <div v-if="submitState.error" class="room-contribution-empty error">{{ submitState.error }}</div>
          <div v-if="submitState.success" class="room-contribution-empty success">{{ submitState.success }}</div>

          <h3>Kamer reacties</h3>
          <div class="item-reactions-row">
            <button type="button" class="reaction-chip" @click="toggleRoomReaction('heart')">❤️ {{ room.roomReactions?.heartCount || 0 }}</button>
            <button type="button" class="reaction-chip" @click="toggleRoomReaction('support')">🤍 {{ room.roomReactions?.supportCount || 0 }}</button>
            <button type="button" class="reaction-chip" @click="toggleRoomReaction('candle')">🕯️ {{ room.roomReactions?.candleCount || 0 }}</button>
          </div>

          <form class="item-comment-form" @submit.prevent="postRoomComment">
            <input v-model="roomCommentText" type="text" maxlength="500" placeholder="Laat een reactie achter voor deze kamer" />
            <button type="submit" class="secondary-btn">Plaats reactie</button>
          </form>
        </div>

        <div class="settings-right-v2">
          <h3>Bijdragen</h3>
          <div v-if="contributions.length === 0" class="room-contribution-empty">Nog geen bijdragen.</div>
          <ul v-else class="room-contribution-items">
            <li v-for="item in contributions" :key="item._id" class="room-contribution-item">
              <div><strong>Type:</strong> {{ item.type }}</div>
              <div><strong>Naam:</strong> {{ item.giverName }}</div>
              <div><strong>Tekst:</strong> {{ item.tributeText || '-' }}</div>
              <div><strong>Media URL:</strong> {{ item.mediaUrl || '-' }}</div>
              <div><strong>Externe URL:</strong> {{ item.externalUrl || '-' }}</div>

              <div v-if="item.mediaUrl" class="contribution-preview">
                <img v-if="item.type === 'photo' || isImageUrl(item.mediaUrl)" :src="item.mediaUrl" alt="Foto bijdrage" class="contribution-preview-image" />
                <video
                  v-else-if="item.type === 'video_file' || isVideoUrl(item.mediaUrl)"
                  :src="item.mediaUrl"
                  controls
                  preload="metadata"
                  class="contribution-preview-video"
                />
              </div>

              <div v-if="item.externalUrl" class="contribution-preview">
                <iframe
                  v-if="item.type === 'video_url' && getYouTubeEmbedUrl(item.externalUrl)"
                  class="contribution-preview-embed"
                  :src="getYouTubeEmbedUrl(item.externalUrl)"
                  title="Video bijdrage"
                  loading="lazy"
                  referrerpolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowfullscreen
                />
                <iframe
                  v-else-if="item.type === 'music_url' && getSpotifyEmbedUrl(item.externalUrl)"
                  class="contribution-preview-embed"
                  :src="getSpotifyEmbedUrl(item.externalUrl)"
                  title="Muziek bijdrage"
                  loading="lazy"
                  referrerpolicy="strict-origin-when-cross-origin"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                />
                <iframe
                  v-else-if="item.type === 'music_url' && getYouTubeEmbedUrl(item.externalUrl)"
                  class="contribution-preview-embed"
                  :src="getYouTubeEmbedUrl(item.externalUrl)"
                  title="Muziek bijdrage"
                  loading="lazy"
                  referrerpolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowfullscreen
                />
                <video
                  v-else-if="item.type === 'video_url' && isVideoUrl(item.externalUrl)"
                  :src="item.externalUrl"
                  controls
                  preload="metadata"
                  class="contribution-preview-video"
                />
                <audio
                  v-else-if="item.type === 'music_url' && isAudioUrl(item.externalUrl)"
                  class="contribution-preview-audio"
                  :src="item.externalUrl"
                  controls
                />
                <a v-else :href="item.externalUrl" target="_blank" rel="noopener noreferrer">Open link</a>
              </div>

              <div class="item-reactions-row">
                <button type="button" class="reaction-chip" @click="toggleContributionReaction(item._id, 'heart')">❤️ {{ item.reactions?.heartCount || 0 }}</button>
                <button type="button" class="reaction-chip" @click="toggleContributionReaction(item._id, 'support')">🤍 {{ item.reactions?.supportCount || 0 }}</button>
                <button type="button" class="reaction-chip" @click="toggleContributionReaction(item._id, 'candle')">🕯️ {{ item.reactions?.candleCount || 0 }}</button>
              </div>

              <form class="item-comment-form" @submit.prevent="submitContributionComment(item._id)">
                <input
                  v-model="commentDrafts[item._id]"
                  type="text"
                  maxlength="500"
                  placeholder="Laat een reactie achter op deze bijdrage"
                />
                <button type="submit" class="secondary-btn" :disabled="commentStateByItem[item._id]?.loading">
                  {{ commentStateByItem[item._id]?.loading ? 'Bezig...' : 'Plaats reactie' }}
                </button>
              </form>
              <div v-if="commentStateByItem[item._id]?.error" class="room-contribution-empty error">
                {{ commentStateByItem[item._id].error }}
              </div>

              <div class="item-comments-list">
                <strong>Comments ({{ item.comments?.length || 0 }}):</strong>
                <div v-if="!item.comments?.length" class="room-contribution-empty">Nog geen comments.</div>
                <ul v-else class="item-comments-items">
                  <li v-for="comment in item.comments" :key="comment._id || comment.createdAt" class="item-comment-entry">
                    <span class="item-comment-author">{{ comment.displayName || 'Bezoeker' }}:</span>
                    <span>{{ comment.text }}</span>
                  </li>
                </ul>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <div v-else-if="loading && hasEnteredRoom" class="room-empty"><h3>Kamer laden...</h3></div>
      <div v-else-if="error && hasEnteredRoom" class="room-contribution-empty error">{{ error }}</div>
    </div>
  </div>
</template>

<style src="./styles/settings-page.css"></style>

<style scoped>
.settings-page-v2,
.settings-page-v2 h2,
.settings-page-v2 h3,
.settings-page-v2 p,
.settings-page-v2 span,
.settings-page-v2 strong,
.settings-page-v2 div,
.settings-page-v2 li,
.settings-page-v2 label {
  color: #1b2a36;
}

.settings-page-v2 input,
.settings-page-v2 select,
.settings-page-v2 textarea {
  color: #1b2a36;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(92, 113, 125, 0.35);
}

.settings-page-v2 input::placeholder,
.settings-page-v2 textarea::placeholder {
  color: #627280;
}

.settings-page-v2 .room-contribution-item,
.settings-page-v2 .visitor-room-stat,
.settings-page-v2 .visitor-room-hero,
.settings-page-v2 .settings-left-v2,
.settings-page-v2 .settings-right-v2 {
  color: #1b2a36;
}

.visitor-identity-panel {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 16px;
  margin: 0 20px 20px;
  padding: 18px;
  border: 1px solid rgba(92, 113, 125, 0.25);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.75);
}

.visitor-identity-left h3,
.visitor-identity-right h3 {
  margin: 0 0 6px;
}

.visitor-identity-left p,

.visitor-entry-screen {
  min-height: 62vh;
  display: grid;
  place-items: center;
  padding: 28px 18px 40px;
}

.visitor-entry-card {
  width: min(560px, 100%);
  min-height: 420px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(245, 250, 255, 0.96) 72%, rgba(212, 232, 248, 0.98) 100%);
  box-shadow: 0 28px 60px rgba(30, 56, 90, 0.14);
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 18px;
  padding: 40px 28px;
  position: relative;
  overflow: hidden;
}

.visitor-entry-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 20% 82%, rgba(61, 100, 145, 0.18), transparent 28%), radial-gradient(circle at 82% 24%, rgba(233, 177, 37, 0.12), transparent 18%);
  pointer-events: none;
}

.visitor-entry-logo {
  width: 86px;
  height: 86px;
  object-fit: contain;
  position: relative;
  z-index: 1;
}

.visitor-entry-copy {
  margin: 0;
  text-align: center;
  font-size: 1.02rem;
  line-height: 1.55;
  max-width: 34ch;
  color: #1b2a36;
  position: relative;
  z-index: 1;
}

.visitor-entry-btn {
  min-width: 200px;
  position: relative;
  z-index: 1;
}

.visitor-room-sound-status {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  color: #1b2a36;
  font-weight: 600;
}
.visitor-identity-note {
  margin: 0;
  color: #5b6470;
}

.visitor-identity-input-row {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.visitor-identity-input-row input {
  flex: 1;
}

.visitor-identity-right {
  display: grid;
  gap: 10px;
  align-content: start;
}

.contribution-preview {
  margin-top: 8px;
}

.contribution-preview-image,
.contribution-preview-video,
.contribution-preview-embed {
  width: 100%;
  max-width: 420px;
  border-radius: 10px;
  border: 1px solid rgba(92, 113, 125, 0.28);
  background: #fff;
}

.contribution-preview-image,
.contribution-preview-video {
  max-height: 260px;
  object-fit: cover;
}

.contribution-preview-embed {
  aspect-ratio: 16 / 9;
}

.contribution-preview-audio {
  width: 100%;
  max-width: 420px;
}

@media (max-width: 900px) {
  .visitor-identity-panel {
    grid-template-columns: 1fr;
    margin: 0 14px 16px;
  }

  .visitor-identity-input-row {
    flex-direction: column;
  }

  .visitor-entry-card {
    min-height: 360px;
    padding: 32px 18px;
  }
}
</style>
