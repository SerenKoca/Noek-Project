<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNoekState } from '../composables/useNoekState.js'
import { getMyContributions } from '../services/roomService.js'

const router = useRouter()
const state = useNoekState()

const loading = ref(true)
const error = ref('')
const items = ref([])

onMounted(async () => {
  await state.bootstrap()
  if (!state.authState.value?.token) {
    await router.replace('/login')
    return
  }

  try {
    items.value = await getMyContributions()
  } catch (err) {
    error.value = err?.response?.data?.error || 'Kon je bijdragen niet laden.'
  } finally {
    loading.value = false
  }
})

async function goHomeForEditor() {
  if (state.authState.value?.user?.role === 'editor') {
    await router.push('/home')
  }
}

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
</script>

<template>
  <div class="editor-page is-home">
    <div class="home-page-v2">
      <header class="home-topbar-v2">
        <div class="home-brand-v2">
          <strong>Profiel</strong>
          <span>Jouw bijdragen</span>
        </div>
        <div class="home-user-v2">
          <span>{{ state.authState.value?.user?.displayName || state.authState.value?.user?.email }}</span>
          <span class="role-badge">{{ state.authState.value?.user?.role || 'visitor' }}</span>
          <button v-if="state.authState.value?.user?.role === 'editor'" type="button" class="secondary-btn" @click="goHomeForEditor">Editor home</button>
          <button type="button" class="secondary-btn" @click="state.onLogout(); router.replace('/login')">Uitloggen</button>
        </div>
      </header>

      <section class="home-main-v2">
        <div class="home-main-header-v2">
          <div>
            <h2>Mijn bijdragen</h2>
            <p>Overzicht van alles wat je hebt gepost in publieke kamers.</p>
          </div>
        </div>

        <div v-if="loading" class="room-empty">
          <h3>Bezig met laden...</h3>
        </div>
        <div v-else-if="error" class="room-contribution-empty error">{{ error }}</div>
        <div v-else-if="items.length === 0" class="room-empty">
          <h3>Nog geen bijdragen</h3>
          <p>Je bijdragen verschijnen hier zodra je iets post.</p>
        </div>

        <div v-else class="room-grid room-grid-v2">
          <article v-for="item in items" :key="item._id" class="room-card room-card-v2">
            <div class="room-info">
              <strong>{{ item.roomName }}</strong>
              <div class="room-meta">Type: {{ item.type }}</div>
              <div class="room-meta">Naam gever: {{ item.giverName }}</div>
              <div class="room-meta">Tekst: {{ item.tributeText || '-' }}</div>
              <div v-if="item.mediaUrl" class="profile-contribution-preview">
                <img v-if="item.type === 'photo' || isImageUrl(item.mediaUrl)" :src="item.mediaUrl" alt="Foto bijdrage" class="profile-contribution-image" />
                <video
                  v-else-if="item.type === 'video_file' || isVideoUrl(item.mediaUrl)"
                  :src="item.mediaUrl"
                  controls
                  preload="metadata"
                  class="profile-contribution-video"
                />
              </div>

              <div v-if="item.externalUrl" class="profile-contribution-preview">
                <iframe
                  v-if="item.type === 'video_url' && getYouTubeEmbedUrl(item.externalUrl)"
                  class="profile-contribution-embed"
                  :src="getYouTubeEmbedUrl(item.externalUrl)"
                  title="Video bijdrage"
                  loading="lazy"
                  referrerpolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowfullscreen
                />
                <iframe
                  v-else-if="item.type === 'music_url' && getSpotifyEmbedUrl(item.externalUrl)"
                  class="profile-contribution-embed"
                  :src="getSpotifyEmbedUrl(item.externalUrl)"
                  title="Muziek bijdrage"
                  loading="lazy"
                  referrerpolicy="strict-origin-when-cross-origin"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                />
                <audio
                  v-else-if="item.type === 'music_url'"
                  class="profile-contribution-audio"
                  :src="item.externalUrl"
                  controls
                />
                <a v-else :href="item.externalUrl" target="_blank" rel="noopener noreferrer">Open link</a>
              </div>

              <div class="room-meta">Geplaatst: {{ new Date(item.createdAt).toLocaleString('nl-NL') }}</div>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<style src="./styles/home-page.css"></style>

<style scoped>
.profile-contribution-preview {
  margin-top: 8px;
}

.profile-contribution-image,
.profile-contribution-video,
.profile-contribution-embed {
  width: 100%;
  border-radius: 10px;
  border: 1px solid rgba(92, 113, 125, 0.28);
  background: #fff;
}

.profile-contribution-image,
.profile-contribution-video {
  max-height: 240px;
  object-fit: cover;
}

.profile-contribution-embed {
  aspect-ratio: 16 / 9;
}

.profile-contribution-audio {
  width: 100%;
}
</style>
