<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useNoekState } from '../composables/useNoekState.js'
import { getMyContributions } from '../services/roomService.js'
import { changeMyPassword, updateMyProfile } from '../services/authService.js'

const router = useRouter()
const state = useNoekState()

const loading = ref(true)
const error = ref('')
const items = ref([])
const activeTab = ref('profile')
const profileSaving = ref(false)
const profileSaveError = ref('')
const profileSaveSuccess = ref('')
const profileForm = ref({ displayName: '', email: '' })
const passwordSaving = ref(false)
const passwordSaveError = ref('')
const passwordSaveSuccess = ref('')
const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' })

const contributionGroups = computed(() => {
  const normalizeType = (item) => String(item?.type || '').trim().toLowerCase()
  const groupKeyForType = (type) => {
    if (type === 'candle') return 'candle'
    if (type === 'photo') return 'photo'
    if (type === 'video_url' || type === 'video_file') return 'video'
    return 'overig'
  }

  const groupMeta = {
    candle: { key: 'candle', label: 'Candle', description: 'Kaarsen en herdenkingslichten', accent: 'candle' },
    photo: { key: 'photo', label: 'Foto', description: 'Fotoherinneringen en beelden', accent: 'photo' },
    video: { key: 'video', label: 'Video', description: 'Videobestanden en videolinks', accent: 'video' },
    overig: { key: 'overig', label: 'Overig', description: 'Andere bijdragen', accent: 'other' }
  }

  const grouped = new Map(Object.keys(groupMeta).map((key) => [key, []]))

  for (const item of items.value) {
    const type = normalizeType(item)
    const key = groupKeyForType(type)
    grouped.get(key)?.push(item)
  }

  return Object.values(groupMeta).map((meta) => ({
    ...meta,
    items: grouped.get(meta.key) || []
  })).filter((group) => group.items.length > 0)
})

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

watch(
  () => state.authState.value?.user,
  (user) => {
    profileForm.value = {
      displayName: String(user?.displayName || '').trim(),
      email: String(user?.email || '').trim()
    }
  },
  { immediate: true }
)

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

async function saveProfile() {
  const displayName = String(profileForm.value.displayName || '').trim()
  const email = String(profileForm.value.email || '').trim()

  if (!displayName || !email) {
    profileSaveError.value = 'Naam en e-mail zijn verplicht.'
    profileSaveSuccess.value = ''
    return
  }

  profileSaving.value = true
  profileSaveError.value = ''
  profileSaveSuccess.value = ''

  try {
    const result = await updateMyProfile({ displayName, email })
    state.authState.value = result
    profileForm.value = {
      displayName: String(result?.user?.displayName || '').trim(),
      email: String(result?.user?.email || '').trim()
    }
    profileSaveSuccess.value = 'Profiel opgeslagen.'
  } catch (err) {
    profileSaveError.value = err?.response?.data?.error || 'Profiel opslaan mislukt.'
  } finally {
    profileSaving.value = false
  }
}

async function savePassword() {
  const currentPassword = String(passwordForm.value.currentPassword || '')
  const newPassword = String(passwordForm.value.newPassword || '')
  const confirmPassword = String(passwordForm.value.confirmPassword || '')

  if (!currentPassword || !newPassword || !confirmPassword) {
    passwordSaveError.value = 'Vul alle wachtwoordvelden in.'
    passwordSaveSuccess.value = ''
    return
  }

  if (newPassword.length < 8) {
    passwordSaveError.value = 'Nieuw wachtwoord moet minstens 8 tekens hebben.'
    passwordSaveSuccess.value = ''
    return
  }

  if (newPassword !== confirmPassword) {
    passwordSaveError.value = 'De nieuwe wachtwoorden komen niet overeen.'
    passwordSaveSuccess.value = ''
    return
  }

  passwordSaving.value = true
  passwordSaveError.value = ''
  passwordSaveSuccess.value = ''

  try {
    const result = await changeMyPassword({ currentPassword, newPassword })
    state.authState.value = result
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
    passwordSaveSuccess.value = 'Wachtwoord opgeslagen.'
  } catch (err) {
    passwordSaveError.value = err?.response?.data?.error || 'Wachtwoord wijzigen mislukt.'
  } finally {
    passwordSaving.value = false
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

function getContributionTypeLabel(item) {
  const type = String(item?.type || '').trim().toLowerCase()
  if (type === 'candle') return 'Candle'
  if (type === 'photo') return 'Foto'
  if (type === 'video_url') return 'Video-link'
  if (type === 'video_file') return 'Videobestand'
  if (type === 'music_url') return 'Muziek'
  return 'Overig'
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
          <div class="profile-actions profile-actions-top">
            <button type="button" class="secondary-btn" @click="goBack">
              Terug naar home
            </button>
            <button type="button" class="secondary-btn" @click="state.onLogout(); router.replace('/login')">
              Uitloggen
            </button>
          </div>

          <div class="profile-header">
                    <div class="profile-avatar">{{ userInitial }}</div>
                    <div class="profile-info">
                      <h2>{{ visitorDisplayName }}</h2>
              <p class="profile-email">{{ state.authState.value?.user?.email }}</p>
              <p class="profile-role">Rol: <strong>{{ state.authState.value?.user?.role || 'Bezoeker' }}</strong></p>
            </div>
          </div>

          <div class="profile-edit-card">
            <div class="contributions-header">
              <h2>Gegevens aanpassen</h2>
              <p>Werk hier je naam en e-mailadres bij. De wijziging wordt meteen opgeslagen in je account.</p>
            </div>

            <div v-if="profileSaveError" class="profile-save-message is-error">{{ profileSaveError }}</div>
            <div v-if="profileSaveSuccess" class="profile-save-message is-success">{{ profileSaveSuccess }}</div>

            <form class="profile-edit-form" @submit.prevent="saveProfile">
              <label class="profile-field">
                <span>Naam</span>
                <input v-model="profileForm.displayName" type="text" maxlength="80" placeholder="Je naam" />
              </label>

              <label class="profile-field">
                <span>E-mail</span>
                <input v-model="profileForm.email" type="email" placeholder="naam@domein.be" />
              </label>

              <button type="submit" class="secondary-btn profile-save-btn" :disabled="profileSaving">
                {{ profileSaving ? 'Opslaan...' : 'Wijzigingen opslaan' }}
              </button>
            </form>
          </div>

          <div class="profile-edit-card">
            <div class="contributions-header">
              <h2>Wachtwoord wijzigen</h2>
              <p>Gebruik je huidige wachtwoord om een nieuw wachtwoord in te stellen.</p>
            </div>

            <div v-if="passwordSaveError" class="profile-save-message is-error">{{ passwordSaveError }}</div>
            <div v-if="passwordSaveSuccess" class="profile-save-message is-success">{{ passwordSaveSuccess }}</div>

            <form class="profile-edit-form" @submit.prevent="savePassword">
              <label class="profile-field">
                <span>Huidig wachtwoord</span>
                <input v-model="passwordForm.currentPassword" type="password" autocomplete="current-password" placeholder="Huidig wachtwoord" />
              </label>

              <label class="profile-field">
                <span>Nieuw wachtwoord</span>
                <input v-model="passwordForm.newPassword" type="password" autocomplete="new-password" minlength="8" placeholder="Minstens 8 tekens" />
              </label>

              <label class="profile-field">
                <span>Nieuw wachtwoord bevestigen</span>
                <input v-model="passwordForm.confirmPassword" type="password" autocomplete="new-password" minlength="8" placeholder="Herhaal nieuw wachtwoord" />
              </label>

              <button type="submit" class="secondary-btn profile-save-btn" :disabled="passwordSaving">
                {{ passwordSaving ? 'Opslaan...' : 'Wachtwoord wijzigen' }}
              </button>
            </form>
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

          <div v-else class="profile-groups">
            <section v-for="group in contributionGroups" :key="group.key" class="profile-group-card" :class="`is-${group.accent}`">
              <div class="profile-group-header">
                <div>
                  <h3>{{ group.label }}</h3>
                  <p>{{ group.description }}</p>
                </div>
                <span class="profile-group-count">{{ group.items.length }}</span>
              </div>

              <div class="profile-group-grid">
                <article v-for="item in group.items" :key="item._id" class="profile-contribution-card">
                  <div class="profile-contribution-topline">
                    <span class="profile-contribution-type">{{ getContributionTypeLabel(item) }}</span>
                    <span class="profile-contribution-room">{{ item.roomName }}</span>
                  </div>

                  <div class="profile-info">
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

.profile-actions-top {
  justify-content: flex-end;
}

.profile-edit-card {
  background: var(--profile-card);
  padding: 28px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 18px 45px rgba(74, 56, 117, 0.14);
  backdrop-filter: blur(3px);
}

.profile-edit-form {
  display: grid;
  gap: 16px;
  margin-top: 18px;
}

.profile-field {
  display: grid;
  gap: 8px;
}

.profile-field span {
  font-weight: 700;
  color: var(--profile-ink);
}

.profile-field input {
  width: 100%;
  box-sizing: border-box;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid var(--profile-field-border);
  background: var(--profile-field-bg);
  color: var(--profile-ink);
  font: inherit;
}

.profile-field input:focus {
  outline: none;
  border-color: var(--profile-primary);
  box-shadow: 0 0 0 4px rgba(92, 71, 143, 0.12);
}

.profile-save-btn {
  justify-self: flex-start;
}

.profile-save-message {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 12px;
  font-weight: 600;
}

.profile-save-message.is-error {
  background: rgba(180, 56, 74, 0.12);
  color: #8d2434;
}

.profile-save-message.is-success {
  background: rgba(54, 144, 94, 0.12);
  color: #216844;
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

.profile-groups {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.profile-group-card {
  border-radius: 20px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(249, 244, 255, 0.78));
  box-shadow: 0 18px 40px rgba(74, 56, 117, 0.12);
}

.profile-group-card.is-candle {
  background:
    linear-gradient(180deg, rgba(255, 250, 241, 0.98), rgba(255, 242, 215, 0.78));
}

.profile-group-card.is-photo {
  background:
    linear-gradient(180deg, rgba(246, 251, 255, 0.98), rgba(222, 239, 255, 0.76));
}

.profile-group-card.is-video {
  background:
    linear-gradient(180deg, rgba(244, 248, 255, 0.98), rgba(227, 232, 255, 0.78));
}

.profile-group-card.is-other {
  background:
    linear-gradient(180deg, rgba(250, 248, 255, 0.98), rgba(235, 230, 247, 0.78));
}

.profile-group-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.profile-group-header h3 {
  margin: 0 0 6px 0;
  font-size: 1.25rem;
  color: var(--profile-ink);
}

.profile-group-header p {
  margin: 0;
  color: var(--profile-ink-soft);
  font-size: 0.95rem;
}

.profile-group-count {
  min-width: 44px;
  height: 44px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #ffffff;
  background: linear-gradient(135deg, var(--profile-primary), #8f7ac1);
  box-shadow: 0 10px 20px rgba(72, 54, 119, 0.2);
}

.profile-group-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.profile-contribution-card {
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(190, 178, 216, 0.6);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 10px 24px rgba(74, 56, 117, 0.08);
}

.profile-contribution-topline {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}

.profile-contribution-type {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(92, 71, 143, 0.12);
  color: var(--profile-primary);
  font-weight: 700;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.profile-contribution-room {
  color: var(--profile-ink-soft);
  font-size: 0.92rem;
  font-weight: 600;
  text-align: right;
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
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

  .profile-edit-card {
    padding: 20px;
  }

  .profile-tabs {
    overflow-x: auto;
  }

  .profile-tab {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .profile-group-header {
    flex-direction: column;
  }

  .profile-group-count {
    align-self: flex-start;
  }
}

@media (max-width: 640px) {
  .profile-edit-card {
    padding: 16px;
  }

  .profile-group-card {
    padding: 16px;
  }

  .profile-group-grid {
    grid-template-columns: 1fr;
  }

  .profile-contribution-card {
    padding: 14px;
  }
}
</style>
