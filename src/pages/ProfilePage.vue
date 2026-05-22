<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useNoekState } from '../composables/useNoekState.js'
import { getMyContributions } from '../services/roomService.js'

const router = useRouter()
const state = useNoekState()

const loading = ref(true)
const error = ref('')
const items = ref([])
const activeTab = ref('profile')

const branding = computed(() => state.brandingState.value || {})
const userLabel = computed(() => {
  const displayName = String(state.authState.value?.user?.displayName || '').trim()
  if (displayName) return displayName
  const email = String(state.authState.value?.user?.email || '').trim()
  if (email) return email.split('@')[0]
  return 'Gebruiker'
})

const visitedRooms = ref([])

function loadVisitedRooms() {
  try {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem('noek_visited_rooms') || '[]'
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) visitedRooms.value = parsed
  } catch (e) { visitedRooms.value = [] }
}

// prefer local visitor name when account displayName is empty
const visitorDisplayName = computed(() => {
  const displayName = String(state.authState.value?.user?.displayName || '').trim()
  if (displayName) return displayName
  try {
    if (typeof window !== 'undefined') {
      const local = String(window.localStorage.getItem('noek_visitor_name') || '').trim()
      if (local) return local
    }
  } catch (e) {}
  const email = String(state.authState.value?.user?.email || '').trim()
  if (email) return email.split('@')[0]
  return 'Gebruiker'
})
const userInitial = computed(() => {
  const label = userLabel.value.trim()
  return label ? label.charAt(0).toUpperCase() : 'U'
})

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

async function goRoleDashboard() {
  const role = state.authState.value?.user?.role
  if (role === 'editor') {
    await router.push('/home')
    return
  }

  if (role === 'funeral_director') {
    await router.push('/director')
    return
  }

  if (role === 'admin') {
    await router.push('/admin')
  }
}

function goBack() {
  try {
    if (typeof window !== 'undefined') {
      const last = sessionStorage.getItem('noek_last_room')
      if (last) {
        router.push(last)
        return
      }
    }
  } catch (e) {}

  router.push('/home')
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
    <header class="home-topbar-v2 editor-home-topbar">
      <div class="home-brand-v2 editor-home-brand">
        <div v-if="branding.logoUrl" class="editor-home-brand-logo-wrap">
          <img :src="branding.logoUrl" alt="Brand logo" class="editor-home-brand-logo" />
        </div>
        <div v-else class="editor-home-brand-text">
          <strong>{{ branding.directorName || 'Thibaut DELA' }}</strong>
          <span>Uitvaartzorg</span>
        </div>
      </div>

      <div class="editor-home-topbar-actions">
        <button type="button" class="editor-home-user-btn" :title="userLabel">
          <span class="editor-home-user-initial">{{ userInitial }}</span>
          <span class="editor-home-user-name">{{ userLabel }}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true" class="editor-home-user-icon"><path d="M12 12.1a4.2 4.2 0 1 0-4.2-4.2 4.2 4.2 0 0 0 4.2 4.2Zm0 2c-4.4 0-8 2.5-8 5.6v1.2h16v-1.2c0-3.1-3.6-5.6-8-5.6Z"/></svg>
        </button>
      </div>
    </header>

    <div class="profile-container">
      <div class="profile-tabs">
        <button 
          type="button"
          class="profile-tab"
          :class="{ active: activeTab === 'profile' }"
          @click="activeTab = 'profile'"
        >
          Mijn profiel
        </button>
        <button 
          type="button"
          class="profile-tab"
          :class="{ active: activeTab === 'contributions' }"
          @click="activeTab = 'contributions'"
        >
          Mijn bijdragen
        </button>
        <button 
          type="button"
          class="profile-tab"
          :class="{ active: activeTab === 'visited' }"
          @click="(activeTab = 'visited', loadVisitedRooms())"
        >
          Bezochte kamers
        </button>
      </div>

      <div class="profile-content">
        <!-- Profiel Tab -->
        <section v-if="activeTab === 'profile'" class="profile-section">
          <div class="profile-header">
                    <div class="profile-avatar">{{ userInitial }}</div>
                    <div class="profile-info">
                      <h2>{{ visitorDisplayName }}</h2>
              <p class="profile-email">{{ state.authState.value?.user?.email }}</p>
              <p class="profile-role">Rol: <strong>{{ state.authState.value?.user?.role || 'Bezoeker' }}</strong></p>
            </div>
          </div>

          <div class="profile-actions">
            <button type="button" class="secondary-btn" @click="goBack">
              Terug naar home
            </button>
            <button type="button" class="secondary-btn" @click="state.onLogout(); router.replace('/login')">
              Uitloggen
            </button>
          </div>
        </section>

        <!-- Visited rooms Tab -->
        <section v-if="activeTab === 'visited'" class="visited-section">
          <div class="contributions-header">
            <h2>Bezochte kamers</h2>
            <p>Kamers die je recent bezocht hebt</p>
          </div>
          <div v-if="visitedRooms.length === 0" class="room-empty">
            <h3>Geen bezochte kamers</h3>
            <p>Zodra je een kamer bezoekt, verschijnt deze hier.</p>
          </div>
          <div v-else class="visited-list">
            <ul>
              <li v-for="r in visitedRooms" :key="r.path">
                <button type="button" class="secondary-btn" @click="router.push(r.path)">{{ r.name || r.path }}</button>
              </li>
            </ul>
          </div>
        </section>

        <!-- Bijdragen Tab -->
        <section v-if="activeTab === 'contributions'" class="contributions-section">
          <div class="contributions-header">
            <h2>Mijn bijdragen</h2>
            <p>Overzicht van alles wat je hebt gepost in publieke kamers.</p>
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
  </div>
</template>

<style src="./styles/home-page.css"></style>

<style scoped>
.profile-container {
  --profile-ink: #382a69;
  --profile-ink-soft: #4f4379;
  --profile-card: rgba(255, 255, 255, 0.82);
  --profile-field-bg: #fcf9ff;
  --profile-field-border: #beb2d8;
  --profile-primary: #5c478f;
  --profile-primary-hover: #4d3a7c;
  --profile-secondary: #d5a15a;
  --profile-secondary-hover: #c58f48;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 80px);
  background:
    linear-gradient(100deg, #b6b4de 0%, #e8bfd0 56%, #f1ded2 100%);
}

.profile-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid rgba(190, 178, 216, 0.7);
  background: rgba(255, 255, 255, 0.6);
  padding: 0;
  margin: 0;
}

.profile-tab {
  flex: 1;
  padding: 16px 24px;
  border: none;
  background: transparent;
  color: var(--profile-ink-soft);
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  border-bottom: 4px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
}

.profile-tab:hover {
  color: var(--profile-ink);
  background: rgba(255, 255, 255, 0.55);
}

.profile-tab.active {
  color: var(--profile-ink);
  border-bottom-color: var(--profile-primary);
  background: rgba(255, 255, 255, 0.82);
}

.profile-content {
  flex: 1;
  padding: 40px 48px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.profile-section {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 32px;
  background: var(--profile-card);
  padding: 32px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 18px 45px rgba(74, 56, 117, 0.14);
  backdrop-filter: blur(3px);
}

.profile-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--profile-primary), #8f7ac1);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 10px 20px rgba(74, 56, 117, 0.2);
}

.profile-info {
  flex: 1;
}

.profile-info h2 {
  margin: 0 0 8px 0;
  font-size: 1.8rem;
  color: var(--profile-ink);
  font-weight: 700;
}

.profile-email {
  margin: 0 0 12px 0;
  font-size: 1rem;
  color: var(--profile-ink-soft);
}

.profile-role {
  margin: 0;
  font-size: 0.95rem;
  color: var(--profile-ink-soft);
}

.profile-role strong {
  color: var(--profile-primary);
}

.profile-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-start;
  flex-wrap: wrap;
}

.secondary-btn {
  padding: 12px 24px;
  background: linear-gradient(90deg, var(--profile-primary), #8f7ac1);
  color: #ffffff;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 8px 20px rgba(72, 54, 119, 0.22);
}

.secondary-btn:hover {
  background: linear-gradient(90deg, var(--profile-primary-hover), #7f6aac);
}

.contributions-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.contributions-header {
  display: flex;
  flex-direction: column;
}

.contributions-header h2 {
  margin: 0 0 8px 0;
  font-size: 1.6rem;
  color: var(--profile-ink);
  font-weight: 700;
}

.contributions-header p {
  margin: 0;
  color: var(--profile-ink-soft);
  font-size: 0.95rem;
}

.profile-contribution-preview {
  margin-top: 8px;
}

.profile-contribution-image,
.profile-contribution-video,
.profile-contribution-embed {
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--profile-field-border);
  background: rgba(255, 255, 255, 0.92);
}

.visited-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.visited-list ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}

.visited-list .secondary-btn {
  width: 100%;
  text-align: left;
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

@media (max-width: 900px) {
  .profile-header {
    flex-direction: column;
    text-align: center;
  }

  .profile-actions {
    justify-content: center;
  }

  .profile-content {
    padding: 24px 20px;
  }

  .profile-tabs {
    overflow-x: auto;
  }

  .profile-tab {
    flex: 0 0 auto;
    white-space: nowrap;
  }
}
</style>
