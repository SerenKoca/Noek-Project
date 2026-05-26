<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNoekState } from '../composables/useNoekState.js'
import ThreeScene from '../components/ThreeScene.vue'
import { applyBrandingTheme } from '../services/brandTheme.js'
import {
  createFuneralDirector,
  deleteFuneralDirector,
  getFuneralDirectorDetails,
  getFuneralDirectors,
  getTemplateRoom,
  updateTemplateRoom
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
const templateLoading = ref(false)
const templateSaving = ref(false)
const templateError = ref('')
const templateStatus = ref('')
const templateRoomName = ref('')
const templateSceneData = ref(null)
const templateSceneRef = ref(null)
const form = ref({
  displayName: '',
  email: '',
  password: ''
})

const NOEK_BRANDING = {
  logoUrl: '/img/logo-noek.svg',
  directorName: 'Noek',
  darkColor: '#382a69',
  lightColor: '#d5a15a'
}

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

async function loadTemplateRoom() {
  templateLoading.value = true
  templateError.value = ''
  templateStatus.value = ''

  try {
    const result = await getTemplateRoom()
    templateRoomName.value = String(result?.name || 'Template kamer')
    templateSceneData.value = result?.sceneData ? JSON.parse(JSON.stringify(result.sceneData)) : null
  } catch (err) {
    templateError.value = formatApiError(err, 'Kon template kamer niet laden.')
    templateSceneData.value = null
  } finally {
    templateLoading.value = false
  }
}

async function openTemplateEditor() {
  await loadTemplateRoom()
  await nextTick()
  document.querySelector('.template-panel-primary')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function saveTemplateRoom() {
  if (!templateSceneRef.value?.serializeRoom) {
    templateError.value = 'Template scene is nog niet klaar om op te slaan.'
    return
  }

  templateSaving.value = true
  templateError.value = ''
  templateStatus.value = ''

  try {
    const sceneData = templateSceneRef.value.serializeRoom()
    const result = await updateTemplateRoom({ sceneData })
    templateRoomName.value = String(result?.name || templateRoomName.value || 'Template kamer')
    templateSceneData.value = result?.sceneData ? JSON.parse(JSON.stringify(result.sceneData)) : sceneData
    templateStatus.value = 'Template opgeslagen.'
  } catch (err) {
    templateError.value = formatApiError(err, 'Kon template niet opslaan.')
  } finally {
    templateSaving.value = false
  }
}

onMounted(async () => {
  await state.bootstrap()
  state.brandingState.value = applyBrandingTheme(NOEK_BRANDING)

  if (!state.authState.value?.token) {
    await router.replace('/login')
    return
  }

  if (state.authState.value?.user?.role !== 'admin') {
    await router.replace('/profile')
    return
  }

  await loadTemplateRoom()
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
    <div class="admin-dashboard">
      <header class="admin-topbar">
        <div class="admin-brand">
          <div class="admin-brand-mark">
            <img src="/img/logo-noek.svg" alt="Noek logo" />
          </div>
          <div class="admin-brand-copy">
            <span>Noek</span>
            <small>Super admin</small>
          </div>
        </div>

        <div class="admin-topbar-actions">
          <div class="admin-user-pill">
            <span class="admin-user-name">{{ state.authState.value?.user?.displayName || state.authState.value?.user?.email }}</span>
            <span class="admin-role-badge">admin</span>
          </div>
          <button type="button" class="admin-template-btn" @click="openTemplateEditor">Open template editor</button>
          <button type="button" class="admin-ghost-btn" @click="loadDirectors">Ververs</button>
          <button type="button" class="admin-logout-btn" @click="logout">Uitloggen</button>
        </div>
      </header>

      <main class="admin-main">
        <section class="admin-hero">
          <h1>Noek super admin</h1>
          <p>Beheer uitvaartondernemers, de templatekamer en de basis van het platform.</p>
        </section>

        <div class="admin-grid">
          <article class="admin-panel create-panel">
            <header class="admin-panel-head">
              <h2>Uitvaartondernemer aanmaken</h2>
              <p>Nieuwe accounts voor een uitvaartondernemer maak je hier aan.</p>
            </header>

            <form class="admin-create-form" @submit.prevent="submitCreateDirector">
              <label class="admin-field">
                <span>Naam</span>
                <input v-model="form.displayName" type="text" placeholder="volledige naam" />
              </label>
              <label class="admin-field">
                <span>Email</span>
                <input v-model="form.email" type="email" placeholder="emailadres" />
              </label>
              <label class="admin-field">
                <span>Tijdelijk wachtwoord</span>
                <input v-model="form.password" type="password" placeholder="min. 8 tekens" />
              </label>
              <button type="submit" class="admin-primary-btn">Uitvaartondernemer aanmaken</button>
            </form>

            <div v-if="status" class="admin-inline-status success">{{ status }}</div>
            <div v-if="error" class="admin-inline-status error">{{ error }}</div>
          </article>

          <article class="admin-panel directors-panel">
            <header class="admin-panel-head split">
              <div>
                <h2>Uitvaartondernemers</h2>
                <p>Overzicht van alle bestaande accounts met snelle acties.</p>
              </div>
              <button type="button" class="admin-secondary-btn" @click="loadDirectors">Ververs</button>
            </header>

            <div v-if="loading" class="admin-empty compact">Bezig met laden...</div>

            <div v-else-if="directors.length === 0" class="admin-empty compact">Nog geen uitvaartondernemers.</div>

            <div v-else class="admin-director-list">
              <article v-for="item in directors" :key="item.id" class="admin-director-card">
                <div class="admin-director-main">
                  <strong>{{ item.displayName }}</strong>
                  <span>{{ item.email }}</span>
                  <small>Aangemaakt: {{ new Date(item.createdAt).toLocaleString('nl-NL') }}</small>
                </div>
                <div class="admin-director-actions">
                  <button type="button" class="admin-ghost-btn small" @click="showDirectorDetails(item)">
                    {{ selectedDirectorId === item.id ? 'Sluit details' : 'Bekijk details' }}
                  </button>
                  <button type="button" class="admin-danger-btn" @click="removeDirector(item)">Verwijder</button>
                </div>
              </article>
            </div>
          </article>
        </div>

        <section v-if="selectedDirectorId" class="admin-panel details-panel">
          <header class="admin-panel-head">
            <h2>Details uitvaartondernemer</h2>
            <p>Branding, klanten en kamers van de geselecteerde uitvaartondernemer.</p>
          </header>

          <div v-if="detailsLoading" class="admin-empty compact">Details laden...</div>
          <div v-else-if="detailsError" class="admin-inline-status error">{{ detailsError }}</div>

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
              <h3>Branding gekozen</h3>
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
              <h3>Klanten en kamers</h3>
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

        <section class="admin-panel template-panel template-panel-primary">
          <div class="template-panel-header">
            <div>
              <h2>Template kamer</h2>
              <p>Hier pas je direct de punten, voorwerpen en basisopstelling van de template aan.</p>
            </div>
            <button type="button" class="admin-secondary-btn" @click="loadTemplateRoom">Herladen</button>
          </div>

          <div v-if="templateStatus" class="admin-inline-status success">{{ templateStatus }}</div>
          <div v-if="templateError" class="admin-inline-status error">{{ templateError }}</div>

          <div v-if="templateLoading" class="admin-empty compact">Template laden...</div>

          <div v-else-if="!templateSceneData" class="admin-empty compact">
            Er is nog geen template kamer geladen.
          </div>

          <div v-else class="template-scene-wrap template-scene-wrap-large">
            <ThreeScene
              ref="templateSceneRef"
              class="template-scene template-scene-large"
              :room-data="templateSceneData"
              :can-edit-template="true"
              :admin-mode="true"
              :use-stored-template="false"
              :hide-local-template-actions="true"
            />

            <div class="template-modal-actions">
              <button type="button" class="admin-primary-btn" :disabled="templateSaving" @click="saveTemplateRoom">
                {{ templateSaving ? 'Opslaan...' : 'Template opslaan' }}
              </button>
            </div>
          </div>
        </section>

      </main>
    </div>
  </div>
</template>

<style scoped>
.editor-page.is-home {
  height: auto;
  min-height: 100vh;
  overflow-y: auto;
}

.admin-dashboard {
  min-height: 100vh;
  overflow-y: auto;
  --editor-brand: #382a69;
  --editor-panel: #fcf9ff;
  --editor-panel-soft: #f1e6fa;
  --editor-panel-strong: #5c478f;
  --editor-border: #beb2d8;
  --editor-border-strong: #a99ac8;
  --editor-text: #382a69;
  --editor-text-soft: #4f4379;
  --editor-primary-hover: #4d3a7c;
  background:
    linear-gradient(100deg, #b6b4de 0%, #e8bfd0 56%, #f1ded2 100%);
}

.admin-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 22px;
  background: rgba(255, 255, 255, 0.72);
  border-bottom: 1px solid var(--editor-border);
  box-shadow: 0 4px 16px rgba(8, 18, 30, 0.06);
}

.admin-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.admin-brand-mark {
  min-width: 150px;
  display: inline-grid;
  place-items: center;
  padding: 10px 16px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid var(--editor-border);
  box-shadow: 0 4px 10px rgba(8, 18, 30, 0.08);
}

.admin-brand-mark img {
  max-height: 48px;
  max-width: 220px;
  object-fit: contain;
  display: block;
}

.admin-brand-copy {
  display: grid;
  gap: 2px;
}

.admin-brand-copy span {
  font-size: 0.98rem;
  font-weight: 700;
  color: var(--editor-brand);
}

.admin-brand-copy small {
  color: var(--editor-text-soft);
}

.admin-topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.admin-user-pill {
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--editor-border);
  color: var(--editor-text);
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.admin-role-badge {
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--editor-panel-strong);
  color: #fff;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.admin-ghost-btn,
.admin-secondary-btn,
.admin-primary-btn,
.admin-template-btn,
.admin-logout-btn,
.admin-danger-btn {
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  font: inherit;
}

.admin-ghost-btn,
.admin-secondary-btn {
  padding: 12px 16px;
  background: var(--editor-brand);
  color: #fff;
  font-weight: 700;
}

.admin-template-btn {
  padding: 12px 18px;
  background: linear-gradient(90deg, var(--editor-primary-hover), var(--editor-brand));
  color: #fff;
  font-weight: 800;
  box-shadow: 0 10px 22px color-mix(in srgb, var(--editor-brand) 20%, transparent);
}

.admin-template-btn:hover {
  filter: brightness(1.03);
}

.admin-ghost-btn.small {
  padding: 10px 12px;
}

.admin-logout-btn,
.admin-danger-btn {
  padding: 12px 16px;
  background: #8a2a34;
  color: #fff;
  font-weight: 700;
}

.admin-primary-btn {
  padding: 13px 16px;
  background: linear-gradient(90deg, var(--editor-brand), var(--editor-primary-hover, var(--editor-brand)));
  color: #fff;
  font-weight: 700;
  box-shadow: 0 10px 22px color-mix(in srgb, var(--editor-brand) 22%, transparent);
}

.admin-main {
  max-width: 1500px;
  margin: 0 auto;
  padding: 30px 28px 38px;
  display: grid;
  gap: 22px;
}

.admin-hero {
  padding: 8px 4px 4px;
}

.admin-hero h1 {
  margin: 0;
  color: var(--editor-brand);
  font-size: clamp(2rem, 3vw, 2.8rem);
  line-height: 1.05;
}

.admin-hero p {
  margin: 8px 0 0;
  color: var(--editor-text-soft);
  font-size: 0.98rem;
}

.admin-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 18px;
  align-items: start;
}

.template-panel-primary {
  margin-bottom: 2px;
}

.admin-panel {
  border: 1px solid var(--editor-border);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 10px 24px rgba(8, 18, 30, 0.08);
  padding: 18px;
  display: grid;
  gap: 14px;
}

.admin-panel-head h2 {
  margin: 0;
  color: var(--editor-brand);
  font-size: 1.35rem;
}

.admin-panel-head p {
  margin: 6px 0 0;
  color: var(--editor-text-soft);
  line-height: 1.45;
}

.admin-panel-head.split {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.brand-preview {
  display: grid;
  gap: 12px;
}

.brand-logo-shell {
  min-height: 110px;
  border-radius: 12px;
  border: 1px solid var(--editor-border);
  background: #fff;
  display: grid;
  place-items: center;
  padding: 16px;
}

.brand-logo {
  max-height: 64px;
  max-width: 100%;
  object-fit: contain;
}

.brand-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.brand-swatch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--editor-border);
  background: #fff;
  color: var(--editor-text);
  font-size: 0.9rem;
  font-weight: 600;
}

.brand-swatch i {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(16, 36, 56, 0.2);
}

.admin-create-form {
  display: grid;
  gap: 12px;
}

.admin-field {
  display: grid;
  gap: 6px;
  color: var(--editor-text);
  font-size: 0.92rem;
  font-weight: 600;
}

.admin-field input[type='text'],
.admin-field input[type='email'],
.admin-field input[type='password'] {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--editor-border);
  border-radius: 10px;
  background: rgba(252, 249, 255, 0.98);
  padding: 12px 14px;
  font: inherit;
  color: var(--editor-text);
}

.admin-inline-status {
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 0.93rem;
  font-weight: 600;
}

.admin-inline-status.success {
  background: #f1e6fa;
  color: #1d6f42;
  border: 1px solid #b8e2c6;
}

.admin-inline-status.error {
  background: #fdebed;
  color: #8a2a34;
  border: 1px solid #efb7bf;
}

.admin-empty {
  border: 1px dashed var(--editor-border-strong);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.78);
  color: var(--editor-text-soft);
  display: grid;
  place-items: center;
  text-align: center;
}

.admin-empty.compact {
  min-height: 92px;
  padding: 14px;
}

.admin-director-list {
  display: grid;
  gap: 10px;
  max-height: 520px;
  overflow-y: auto;
  padding-right: 4px;
}

.admin-director-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--editor-border);
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 6px 14px rgba(8, 18, 30, 0.08);
}

.admin-director-main {
  display: grid;
  gap: 4px;
}

.admin-director-main strong {
  color: var(--editor-brand);
  font-size: 1.05rem;
}

.admin-director-main span,
.admin-director-main small,
.room-meta {
  color: var(--editor-text-soft);
}

.admin-director-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.admin-details-panel {
  display: grid;
  gap: 14px;
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
  border: 1px solid var(--editor-border);
  border-radius: 10px;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.92);
}

.admin-stat-card span {
  display: block;
  color: var(--editor-text-soft);
  font-size: 0.86rem;
}

.admin-stat-card strong {
  font-size: 1.4rem;
  color: var(--editor-brand);
}

.admin-info-card {
  border: 1px solid var(--editor-border);
  border-radius: 10px;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.92);
}

.admin-info-card h3 {
  margin: 0 0 0.5rem;
  color: var(--editor-brand);
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
  border: 1px solid var(--editor-border);
  background: rgba(252, 249, 255, 0.96);
  color: var(--editor-brand);
  font-size: 0.86rem;
  font-weight: 600;
}

.admin-color-pill i {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.admin-client-list {
  display: grid;
  gap: 0.75rem;
}

.admin-client-item {
  border: 1px solid var(--editor-border);
  border-radius: 10px;
  padding: 0.7rem;
  background: rgba(252, 249, 255, 0.96);
}

.admin-client-head {
  margin: 0.25rem 0 0;
  color: var(--editor-text-soft);
}

.template-scene-shell {
  display: grid;
  gap: 0.75rem;
}

.template-scene-wrap {
  display: grid;
  gap: 0.75rem;
}

.template-scene {
  width: 100%;
  min-height: 420px;
}

.template-scene-wrap-large {
  gap: 12px;
}

.template-scene-large {
  min-height: 620px;
}

.template-modal-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

@media (max-width: 1180px) {
  .admin-grid {
    grid-template-columns: 1fr;
  }

  .admin-director-card {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .admin-director-actions {
    flex-wrap: wrap;
  }
}

@media (max-width: 820px) {
  .admin-topbar,
  .admin-topbar-actions,
  .template-panel-header {
    flex-direction: column;
    align-items: stretch;
  }

  .admin-main {
    padding: 20px 16px 28px;
  }

  .admin-brand {
    width: 100%;
  }

  .admin-brand-mark {
    min-width: 132px;
  }
}
</style>