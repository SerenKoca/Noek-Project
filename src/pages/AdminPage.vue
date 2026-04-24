<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNoekState } from '../composables/useNoekState.js'
import {
  createFuneralDirector,
  deleteFuneralDirector,
  getFuneralDirectorDetails,
  getFuneralDirectors
} from '../services/adminService.js'
import './styles/home-page.css'
import './styles/auth-page.css'

const router = useRouter()
const state = useNoekState()

const loading = ref(true)
const status = ref('')
const error = ref('')
const directors = ref([])
const selectedDirectorId = ref('')
const selectedDetails = ref(null)
const detailsLoading = ref(false)
const detailsError = ref('')
const form = ref({
  displayName: '',
  email: '',
  password: ''
})

function formatApiError(err, fallback) {
  const data = err?.response?.data || {}
  const message = typeof data.error === 'string'
    ? data.error
    : data.error
      ? JSON.stringify(data.error)
      : fallback
  const code = data.code ? ` (${String(data.code)})` : ''
  return `${message}${code}`
}

async function loadDirectors() {
  loading.value = true
  error.value = ''

  try {
    directors.value = await getFuneralDirectors()
  } catch (err) {
    error.value = formatApiError(err, 'Kon uitvaartondernemers niet laden.')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await state.bootstrap()

  if (!state.authState.value?.token) {
    await router.replace('/login')
    return
  }

  if (state.authState.value?.user?.role !== 'admin') {
    await router.replace('/profile')
    return
  }

  await loadDirectors()
})

async function submitCreateDirector() {
  status.value = ''
  error.value = ''

  try {
    await createFuneralDirector({
      displayName: form.value.displayName.trim(),
      email: form.value.email.trim(),
      password: form.value.password
    })

    form.value = { displayName: '', email: '', password: '' }
    status.value = 'Uitvaartondernemer aangemaakt.'
    await loadDirectors()
  } catch (err) {
    error.value = formatApiError(err, 'Aanmaken mislukt.')
  }
}

async function removeDirector(item) {
  const ok = window.confirm(`Verwijder uitvaartondernemer ${item.displayName || item.email}?`)
  if (!ok) return

  status.value = ''
  error.value = ''

  try {
    await deleteFuneralDirector(item.id)
    if (selectedDirectorId.value === item.id) {
      selectedDirectorId.value = ''
      selectedDetails.value = null
      detailsError.value = ''
    }
    status.value = 'Uitvaartondernemer verwijderd.'
    await loadDirectors()
  } catch (err) {
    error.value = formatApiError(err, 'Verwijderen mislukt.')
  }
}

async function showDirectorDetails(item) {
  const id = String(item?.id || '').trim()
  if (!id) return

  if (selectedDirectorId.value === id) {
    selectedDirectorId.value = ''
    selectedDetails.value = null
    detailsError.value = ''
    return
  }

  detailsLoading.value = true
  detailsError.value = ''
  selectedDirectorId.value = id

  try {
    selectedDetails.value = await getFuneralDirectorDetails(id)
  } catch (err) {
    selectedDetails.value = null
    detailsError.value = formatApiError(err, 'Kon details niet laden.')
  } finally {
    detailsLoading.value = false
  }
}

async function logout() {
  state.onLogout()
  await router.replace('/login')
}
</script>

<template>
  <div class="editor-page is-home">
    <div class="auth-page-v2 admin-auth-page">
      <div class="auth-card-v2 admin-auth-card">
        <section class="auth-hero-v2 admin-hero">
          <div class="auth-logo-v2">
            <img src="/img/logo-noek.svg" alt="Noek logo" class="auth-logo-image-v2" />
          </div>
          <h1>Hoofdadmin</h1>
          <p>Beheer uitvaartondernemers en bekijk klanten, kamers en gekozen branding.</p>
          <div class="auth-candle-scene-v2" aria-hidden="true">
            <div class="auth-candle-v2 is-large">
              <span class="auth-candle-flame-v2"></span>
              <span class="auth-candle-wax-v2"></span>
            </div>
            <div class="auth-candle-v2 is-small">
              <span class="auth-candle-flame-v2"></span>
              <span class="auth-candle-wax-v2"></span>
            </div>
          </div>
        </section>

        <section class="auth-form-v2 admin-form-v2">
          <header class="admin-toolbar">
            <div class="admin-toolbar-user">
              <strong>{{ state.authState.value?.user?.displayName || state.authState.value?.user?.email }}</strong>
              <span class="role-badge">admin</span>
            </div>
            <div class="admin-toolbar-actions">
              <button type="button" class="auth-switch-v2" @click="loadDirectors">Ververs</button>
              <button type="button" class="auth-switch-v2" @click="logout">Uitloggen</button>
            </div>
          </header>

          <div class="admin-title-block">
            <h2>Uitvaartondernemers</h2>
            <p>Maak accounts aan en beheer bestaande uitvaartondernemers.</p>
          </div>

          <form class="admin-create-form" @submit.prevent="submitCreateDirector">
            <label class="auth-field-v2">
              <span>Naam</span>
              <input v-model="form.displayName" type="text" placeholder="volledige naam" />
            </label>
            <label class="auth-field-v2">
              <span>Email</span>
              <input v-model="form.email" type="email" placeholder="emailadres" />
            </label>
            <label class="auth-field-v2">
              <span>Tijdelijk wachtwoord</span>
              <input v-model="form.password" type="password" placeholder="min. 8 tekens" />
            </label>
            <button type="submit" class="auth-submit-v2">Uitvaartondernemer aanmaken</button>
          </form>

          <div v-if="status" class="auth-status-v2 success">{{ status }}</div>
          <div v-if="error" class="auth-status-v2 error">{{ error }}</div>

          <div v-if="loading" class="room-empty compact-empty">
            <h3>Bezig met laden...</h3>
          </div>

          <div v-else-if="directors.length === 0" class="room-empty compact-empty">
            <h3>Geen uitvaartondernemers</h3>
            <p>Maak hierboven een eerste account aan.</p>
          </div>

          <div v-else class="room-grid room-grid-v2">
            <article v-for="item in directors" :key="item.id" class="room-card room-card-v2 admin-room-card">
              <div class="room-info">
                <strong>{{ item.displayName }}</strong>
                <div class="room-meta">{{ item.email }}</div>
                <div class="room-meta">Aangemaakt: {{ new Date(item.createdAt).toLocaleString('nl-NL') }}</div>
              </div>
              <div class="room-actions-row room-actions-row-v2">
                <button
                  type="button"
                  class="auth-switch-v2 details-btn"
                  @click="showDirectorDetails(item)"
                >
                  {{ selectedDirectorId === item.id ? 'Sluit details' : 'Bekijk details' }}
                </button>
                <button type="button" class="danger-btn" @click="removeDirector(item)">Verwijder</button>
              </div>
            </article>
          </div>

          <section v-if="selectedDirectorId" class="admin-details-panel">
            <h3>Details uitvaartondernemer</h3>

            <div v-if="detailsLoading" class="room-empty compact-empty">
              <h3>Details laden...</h3>
            </div>

            <div v-else-if="detailsError" class="auth-status-v2 error">{{ detailsError }}</div>

            <div v-else-if="selectedDetails" class="admin-details-body">
              <div class="admin-stats-row">
                <article class="admin-stat-card">
                  <span>Klanten</span>
                  <strong>{{ selectedDetails.stats?.clientCount ?? 0 }}</strong>
                </article>
                <article class="admin-stat-card">
                  <span>Kamers</span>
                  <strong>{{ selectedDetails.stats?.roomCount ?? 0 }}</strong>
                </article>
              </div>

              <article class="admin-info-card">
                <h4>Branding gekozen</h4>
                <div class="room-meta">Logo: {{ selectedDetails.branding?.logoUrl || 'Geen logo' }}</div>
                <div class="admin-color-row">
                  <span class="admin-color-pill">
                    Donker: {{ selectedDetails.branding?.darkColor || '-' }}
                    <i :style="{ backgroundColor: selectedDetails.branding?.darkColor || '#1e2b37' }" />
                  </span>
                  <span class="admin-color-pill">
                    Licht: {{ selectedDetails.branding?.lightColor || '-' }}
                    <i :style="{ backgroundColor: selectedDetails.branding?.lightColor || '#d7e1eb' }" />
                  </span>
                </div>
              </article>

              <article class="admin-info-card">
                <h4>Klanten en kamers</h4>
                <div v-if="(selectedDetails.clients || []).length === 0" class="room-meta">
                  Geen klanten gekoppeld aan deze uitvaartondernemer.
                </div>
                <div v-else class="admin-client-list">
                  <div v-for="client in selectedDetails.clients" :key="client.id" class="admin-client-item">
                    <div class="admin-client-head">
                      <strong>{{ client.displayName }}</strong>
                      <span>{{ client.email }}</span>
                      <span>{{ client.roomCount }} kamer(s)</span>
                    </div>
                    <ul v-if="(client.rooms || []).length" class="admin-room-list">
                      <li v-for="room in client.rooms" :key="room.id">
                        {{ room.name }}
                        <span>{{ room.isPublic ? 'Publiek' : 'Privaat' }}</span>
                      </li>
                    </ul>
                    <p v-else class="room-meta">Nog geen kamers.</p>
                  </div>
                </div>
              </article>
            </div>
          </section>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-auth-page {
  padding: 28px;
}

.admin-auth-card {
  width: min(1180px, 100%);
  grid-template-columns: minmax(300px, 0.85fr) minmax(0, 1.45fr);
}

.admin-form-v2 {
  padding-top: 42px;
  gap: 16px;
  max-height: min(90vh, 920px);
  overflow: auto;
}

.admin-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.admin-toolbar-user {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--auth-ink);
}

.admin-toolbar-actions {
  display: inline-flex;
  gap: 0.75rem;
}

.admin-title-block h2 {
  margin: 0;
  color: var(--auth-ink);
}

.admin-title-block p {
  margin: 0.3rem 0 0;
  color: var(--auth-ink-soft);
}

.admin-create-form {
  display: grid;
  gap: 12px;
}

.admin-room-card {
  border-color: var(--auth-field-border);
  background: #fffdfd;
}

.details-btn {
  text-decoration: none;
}

.admin-details-panel {
  margin-top: 0.35rem;
  padding: 1rem;
  border: 1px solid var(--auth-field-border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.75);
}

.admin-details-panel h3 {
  margin: 0 0 0.75rem;
  color: var(--auth-ink);
}

.admin-details-body {
  display: grid;
  gap: 0.9rem;
}

.admin-stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
}

.admin-stat-card {
  border: 1px solid var(--auth-field-border);
  border-radius: 10px;
  padding: 0.75rem;
  background: #fcf9ff;
}

.admin-stat-card span {
  display: block;
  color: var(--auth-ink-soft);
  font-size: 0.86rem;
}

.admin-stat-card strong {
  font-size: 1.4rem;
  color: var(--auth-ink);
}

.admin-info-card {
  border: 1px solid var(--auth-field-border);
  border-radius: 10px;
  padding: 0.75rem;
  background: #ffffff;
}

.admin-info-card h4 {
  margin: 0 0 0.5rem;
  color: var(--auth-ink);
}

.admin-color-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.4rem;
}

.admin-color-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.55rem;
  border-radius: 999px;
  border: 1px solid var(--auth-field-border);
  background: #fcf9ff;
  color: var(--auth-ink);
  font-size: 0.86rem;
}

.admin-color-pill i {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.2);
}

.admin-client-list {
  display: grid;
  gap: 0.6rem;
}

.admin-client-item {
  border: 1px solid var(--auth-field-border);
  border-radius: 8px;
  padding: 0.6rem;
  background: #fcf9ff;
}

.admin-client-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.admin-client-head span {
  color: var(--auth-ink-soft);
  font-size: 0.84rem;
}

.admin-room-list {
  margin: 0.45rem 0 0;
  padding-left: 1rem;
}

.admin-room-list li {
  margin: 0.15rem 0;
}

.admin-room-list li span {
  margin-left: 0.5rem;
  color: var(--auth-ink-soft);
  font-size: 0.84rem;
}

.compact-empty {
  padding: 0.75rem;
}

@media (max-width: 980px) {
  .admin-auth-card {
    grid-template-columns: 1fr;
  }

  .admin-form-v2 {
    max-height: none;
  }
}
</style>
