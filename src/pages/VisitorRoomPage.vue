<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ThreeScene from '../components/ThreeScene.vue'
import {
  addPublicRoomComment,
  createPublicRoomContribution,
  getPublicRoom,
  getPublicRoomContributions,
  reactToPublicRoom,
  reactToPublicRoomContribution
} from '../services/visitorService.js'
import { getStoredAuth } from '../services/authService.js'

const VISITOR_NAME_STORAGE = 'noek_visitor_name'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => String(route.params.id || ''))

const room = ref(null)
const contributions = ref([])
const loading = ref(true)
const error = ref('')
const submitState = ref({ loading: false, error: '', success: '' })
const profileHint = ref('')

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

function ensureVisitorNameInitialized() {
  const saved = readStoredVisitorName()
  if (saved) {
    visitorName.value = saved
    return
  }

  visitorName.value = authDisplayName.value || 'Bezoeker'
  persistVisitorName(visitorName.value)
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

onMounted(loadAll)
onMounted(ensureVisitorNameInitialized)

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
      platform: type.value === 'music_url' ? 'spotify' : type.value === 'video_url' ? 'youtube' : 'none'
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

      <section class="visitor-room-hero" v-if="room">
        <div class="visitor-room-hero-copy">
          <span class="role-badge visitor-room-badge">bezoeker</span>
          <h3>Welkom in deze kamer</h3>
          <p>
            Je kan de kamer bekijken, bijdragen toevoegen en reageren zonder editorrechten.
          </p>
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

      <section class="visitor-identity-panel" v-if="!loading && !error">
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

      <section class="visitor-room-scene-shell" v-if="room">
        <div class="editor-scene-panel visitor-room-scene-panel">
          <ThreeScene class="editor-scene visitor-room-scene" :room-data="roomSceneData" />
        </div>
      </section>

      <section class="settings-content-v2" v-if="!loading && !error && room">
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
              <div><strong>Link:</strong> {{ item.externalUrl || item.mediaUrl || '-' }}</div>

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
                <audio
                  v-else-if="item.type === 'music_url'"
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
            </li>
          </ul>
        </div>
      </section>

      <div v-else-if="loading" class="room-empty"><h3>Kamer laden...</h3></div>
      <div v-else class="room-contribution-empty error">{{ error }}</div>
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
}
</style>
