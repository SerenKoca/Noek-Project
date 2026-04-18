<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
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

const route = useRoute()
const roomId = computed(() => String(route.params.id || ''))

const room = ref(null)
const contributions = ref([])
const loading = ref(true)
const error = ref('')
const submitState = ref({ loading: false, error: '', success: '' })

const giverName = ref(getStoredAuth()?.user?.displayName || '')
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

async function addContribution() {
  submitState.value = { loading: true, error: '', success: '' }
  try {
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
      giverName: giverName.value,
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
    room.value = await addPublicRoomComment(roomId.value, {
      text: roomCommentText.value,
      displayName: giverName.value
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

      <section class="visitor-room-scene-shell" v-if="room">
        <div class="editor-scene-panel visitor-room-scene-panel">
          <ThreeScene class="editor-scene visitor-room-scene" :room-data="roomSceneData" />
        </div>
      </section>

      <section class="settings-content-v2" v-if="!loading && !error && room">
        <div class="settings-left-v2">
          <h3>Bijdrage plaatsen</h3>
          <p class="visitor-room-note">Foto of video bestand uploaden kan ook, zolang je er een bestand bij kiest.</p>
          <label class="auth-field-v2">
            <span>Jouw naam</span>
            <input v-model="giverName" type="text" placeholder="Je naam" />
          </label>
          <label class="auth-field-v2">
            <span>Type</span>
            <select v-model="type">
              <option value="candle">Kaarsje</option>
              <option value="music_url">Muzieklink</option>
              <option value="video_url">Videolink</option>
              <option value="photo">Foto (URL)</option>
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
