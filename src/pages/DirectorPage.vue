<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNoekState } from '../composables/useNoekState.js'
import { generateEditorCode, getMyBranding, getMyEditorCodes, getMyEditors, updateMyBranding } from '../services/directorService.js'
import { applyBrandingTheme, normalizeBranding } from '../services/brandTheme.js'
import './styles/home-page.css'
import './styles/auth-page.css'

const router = useRouter()
const state = useNoekState()

const loading = ref(true)
const error = ref('')
const success = ref('')
const editors = ref([])
const codes = ref([])
const codeLifetimeDays = ref(30)
const branding = ref({
  logoUrl: '',
  darkColor: '#1e2b37',
  lightColor: '#d7e1eb'
})
const logoFile = ref(null)
const brandingState = ref({ saving: false, uploading: false })

async function copyCode(code) {
  const value = String(code || '').trim()
  if (!value) return

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      success.value = `Code ${value} gekopieerd.`
    }
  } catch {
    window.prompt('Kopieer deze code', value)
  }
}

function getCodeStatus(item) {
  if (item?.usedAt) {
    return { label: 'gebruikt', className: 'used' }
  }

  const expiresAt = item?.expiresAt ? new Date(item.expiresAt) : null
  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
    return { label: 'vervallen', className: 'expired' }
  }

  return { label: 'ongebruikt', className: 'open' }
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

async function loadDirectorData() {
  loading.value = true
  error.value = ''

  try {
    const [editorList, codeList, brand] = await Promise.all([getMyEditors(), getMyEditorCodes(), getMyBranding()])
    editors.value = editorList
    codes.value = codeList
    branding.value = normalizeBranding(brand)
    state.brandingState.value = applyBrandingTheme(branding.value)
  } catch (err) {
    error.value = formatApiError(err, 'Kon gegevens niet laden.')
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

  if (state.authState.value?.user?.role !== 'funeral_director') {
    await router.replace('/profile')
    return
  }

  await loadDirectorData()
})

async function createCode() {
  error.value = ''
  success.value = ''

  try {
    const item = await generateEditorCode({ expiresInDays: Number(codeLifetimeDays.value) || 30 })
    success.value = `Nieuwe code: ${item.code}`
    await loadDirectorData()
  } catch (err) {
    error.value = formatApiError(err, 'Code genereren mislukt.')
  }
}

function onLogoFileChange(event) {
  logoFile.value = event.target.files?.[0] || null
}

async function uploadLogoToCloudinary(file) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || ''
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || ''

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary configuratie ontbreekt.')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    throw new Error('Logo upload mislukt.')
  }

  return response.json()
}

async function saveBranding() {
  error.value = ''
  success.value = ''
  brandingState.value = { saving: true, uploading: false }

  try {
    let logoUrl = String(branding.value.logoUrl || '').trim()
    if (logoFile.value) {
      brandingState.value = { saving: true, uploading: true }
      const uploadResult = await uploadLogoToCloudinary(logoFile.value)
      logoUrl = String(uploadResult.secure_url || '').trim()
    }

    const saved = await updateMyBranding({
      logoUrl,
      darkColor: branding.value.darkColor,
      lightColor: branding.value.lightColor
    })

    branding.value = normalizeBranding(saved)
    state.brandingState.value = applyBrandingTheme(branding.value)
    success.value = 'Branding opgeslagen. Deze stijl is nu actief voor jouw editors en bezoekers.'
    logoFile.value = null
  } catch (err) {
    error.value = formatApiError(err, 'Branding opslaan mislukt.')
  } finally {
    brandingState.value = { saving: false, uploading: false }
  }
}

async function logout() {
  state.onLogout()
  await router.replace('/login')
}
</script>

<template>
  <div class="editor-page is-home">
    <div class="director-dashboard">
      <header class="director-topbar">
        <div class="director-brand">
          <div class="director-brand-mark">
            <img v-if="branding.logoUrl" :src="branding.logoUrl" alt="Brand logo" />
            <strong v-else>{{ branding.directorName || 'Uitvaartondernemer' }}</strong>
          </div>
        </div>

        <div class="director-topbar-actions">
          <div class="director-user-pill">
            <span class="director-user-name">{{ state.authState.value?.user?.displayName || state.authState.value?.user?.email }}</span>
          </div>
          <button type="button" class="director-logout-btn" @click="logout">Uitloggen</button>
        </div>
      </header>

      <main class="director-main">
        <section class="director-hero">
          <h1>Welkom, {{ branding.directorName || 'Uitvaartondernemer' }}</h1>
          <p>Beheer hier je branding en genereer editorcode voor jouw klanten.</p>
        </section>

        <div class="director-grid">
          <article class="director-panel branding-panel">
            <header class="director-panel-head">
              <h2>Jouw branding</h2>
              <p>Pas je huisstijl hier aan. Klanten zien deze stijl in de editor en in de kamers.</p>
            </header>

            <div class="branding-preview">
              <div class="branding-preview-logo" :class="{ empty: !branding.logoUrl }">
                <img v-if="branding.logoUrl" :src="branding.logoUrl" alt="Brand logo" />
                <span v-else>{{ branding.directorName || 'Logo' }}</span>
              </div>
              <div class="branding-swatches">
                <span class="branding-swatch">
                  Donker
                  <i :style="{ backgroundColor: branding.darkColor }" />
                </span>
                <span class="branding-swatch">
                  Licht
                  <i :style="{ backgroundColor: branding.lightColor }" />
                </span>
              </div>
            </div>

            <div class="branding-form-grid">
              <label class="director-field">
                <span>Donkere kleur</span>
                <input v-model="branding.darkColor" type="color" />
              </label>
              <label class="director-field">
                <span>Lichte kleur</span>
                <input v-model="branding.lightColor" type="color" />
              </label>
            </div>

            <label class="director-field">
              <span>Logo bestand (png/jpg/webp)</span>
              <input type="file" accept="image/*" @change="onLogoFileChange" />
            </label>

            <label class="director-field">
              <span>Of logo URL</span>
              <input v-model="branding.logoUrl" type="url" placeholder="https://..." />
            </label>

            <button type="button" class="director-primary-btn" :disabled="brandingState.saving" @click="saveBranding">
              {{ brandingState.uploading ? 'Logo uploaden...' : brandingState.saving ? 'Opslaan...' : 'Branding opslaan' }}
            </button>
          </article>

          <article class="director-panel code-panel">
            <header class="director-panel-head">
              <h2>Editor code genereren</h2>
              <p>Genereer een nieuwe code die klanten toegang geeft tot de editor.</p>
            </header>

            <label class="director-field director-code-field">
              <span>Aantal dagen beschikbaar</span>
              <input v-model.number="codeLifetimeDays" type="number" min="1" max="365" />
            </label>

            <button type="button" class="director-primary-btn wide" @click="createCode">Code genereren</button>

            <div v-if="success" class="director-inline-status success">{{ success }}</div>
            <div v-if="error" class="director-inline-status error">{{ error }}</div>
          </article>

          <article class="director-panel codes-panel">
            <header class="director-panel-head">
              <h2>Recente codes</h2>
            </header>

            <div v-if="loading" class="director-empty compact">
              Bezig met laden...
            </div>

            <div v-else-if="codes.length === 0" class="director-empty compact">
              Nog geen codes aangemaakt.
            </div>

            <div v-else class="director-code-list">
              <article v-for="item in codes" :key="item.id" class="director-code-card">
                <div class="director-code-main">
                  <div class="director-code-row">
                    <strong>{{ item.code }}</strong>
                    <button type="button" class="director-copy-btn" @click="copyCode(item.code)" aria-label="Code kopiëren">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1zm4 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h12v14z" /></svg>
                    </button>
                  </div>
                  <div class="director-code-meta">Aangemaakt: {{ new Date(item.createdAt).toLocaleString('nl-NL') }}</div>
                  <div class="director-code-meta">Vervalt: {{ item.expiresAt ? new Date(item.expiresAt).toLocaleString('nl-NL') : '-' }}</div>
                </div>
                <span class="director-status-pill" :class="getCodeStatus(item).className">
                  {{ getCodeStatus(item).label }}
                </span>
              </article>
            </div>
          </article>
        </div>

        <section class="director-panel editors-panel">
          <header class="director-panel-head split">
            <div>
              <h2>Mijn klanten (editors)</h2>
              <p>Een overzicht van gekoppelde editors per klant.</p>
            </div>
            <button type="button" class="director-secondary-btn" @click="loadDirectorData">Ververs</button>
          </header>

          <div v-if="editors.length === 0" class="director-empty compact">
            Nog geen gekoppelde editors.
          </div>
          <div v-else class="director-editor-list">
            <article v-for="item in editors" :key="item.id" class="director-editor-card">
              <strong>{{ item.displayName }}</strong>
              <span>{{ item.email }}</span>
              <small>Aangemaakt: {{ new Date(item.createdAt).toLocaleString('nl-NL') }}</small>
            </article>
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

.director-dashboard {
  min-height: 100vh;
  overflow-y: auto;
  background:
    radial-gradient(circle at 10% 0%, color-mix(in srgb, var(--editor-panel) 55%, transparent) 0%, transparent 38%),
    linear-gradient(180deg, color-mix(in srgb, white 94%, var(--editor-panel) 6%) 0%, color-mix(in srgb, white 88%, var(--editor-panel-soft) 12%) 100%);
}

.director-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 22px;
  background: color-mix(in srgb, white 86%, var(--editor-panel) 14%);
  border-bottom: 1px solid var(--editor-border);
  box-shadow: 0 4px 16px rgba(8, 18, 30, 0.06);
}

.director-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.director-brand-mark {
  min-width: 144px;
  display: inline-grid;
  place-items: center;
  padding: 10px 16px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid var(--editor-border);
  box-shadow: 0 4px 10px rgba(8, 18, 30, 0.08);
}

.director-brand-mark img {
  max-height: 48px;
  max-width: 220px;
  object-fit: contain;
  display: block;
}

.director-brand-mark strong {
  color: var(--editor-brand);
  font-size: 1.2rem;
}

.director-brand-copy {
  display: grid;
  gap: 2px;
}

.director-brand-copy span {
  font-size: 0.98rem;
  font-weight: 700;
  color: var(--editor-brand);
}

.director-brand-copy small {
  color: var(--editor-text-soft);
}

.director-topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.director-user-pill {
  padding: 10px 14px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--editor-panel) 26%, white);
  border: 1px solid var(--editor-border);
  color: var(--editor-text);
  font-weight: 700;
}

.director-logout-btn,
.director-secondary-btn,
.director-primary-btn {
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  font: inherit;
}

.director-logout-btn,
.director-secondary-btn {
  padding: 12px 16px;
  background: var(--editor-brand);
  color: #fff;
  font-weight: 700;
}

.director-logout-btn:hover,
.director-secondary-btn:hover {
  background: var(--editor-primary-hover, var(--editor-brand));
}

.director-main {
  max-width: 1500px;
  margin: 0 auto;
  padding: 30px 28px 38px;
  display: grid;
  gap: 22px;
}

.director-hero {
  padding: 8px 4px 4px;
}

.director-hero h1 {
  margin: 0;
  color: var(--editor-brand);
  font-size: clamp(2rem, 3vw, 2.8rem);
  line-height: 1.05;
}

.director-hero p {
  margin: 8px 0 0;
  color: var(--editor-text-soft);
  font-size: 0.98rem;
}

.director-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.director-panel {
  border: 1px solid var(--editor-border);
  border-radius: 16px;
  background: color-mix(in srgb, white 88%, var(--editor-panel) 12%);
  box-shadow: 0 10px 24px rgba(8, 18, 30, 0.08);
  padding: 18px;
  display: grid;
  gap: 14px;
}

.codes-panel {
  max-height: 660px;
  overflow: hidden;
}

.director-panel-head h2 {
  margin: 0;
  color: var(--editor-brand);
  font-size: 1.35rem;
}

.director-panel-head p {
  margin: 6px 0 0;
  color: var(--editor-text-soft);
  line-height: 1.45;
}

.director-panel-head.split {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.branding-preview {
  display: grid;
  gap: 12px;
}

.branding-preview-logo {
  min-height: 86px;
  border-radius: 12px;
  border: 1px solid var(--editor-border);
  background: #fff;
  display: grid;
  place-items: center;
  padding: 14px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.55);
}

.branding-preview-logo img {
  max-height: 58px;
  max-width: 100%;
  object-fit: contain;
}

.branding-preview-logo.empty {
  color: var(--editor-brand);
  font-weight: 700;
}

.branding-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.branding-swatch {
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

.branding-swatch i {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(16, 36, 56, 0.2);
}

.branding-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.director-field {
  display: grid;
  gap: 6px;
  color: var(--editor-text);
  font-size: 0.92rem;
  font-weight: 600;
}

.director-field input[type='text'],
.director-field input[type='url'],
.director-field input[type='number'],
.director-field input[type='file'] {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--editor-border);
  border-radius: 10px;
  background: color-mix(in srgb, white 84%, var(--editor-panel) 16%);
  padding: 12px 14px;
  font: inherit;
  color: var(--editor-text);
}

.director-field input[type='color'] {
  width: 100%;
  height: 44px;
  border: 1px solid var(--editor-border);
  border-radius: 10px;
  background: #fff;
  padding: 4px;
}

.director-code-field input[type='number'] {
  max-width: 260px;
}

.director-primary-btn {
  padding: 13px 16px;
  background: linear-gradient(90deg, var(--editor-brand), var(--editor-primary-hover, var(--editor-brand)));
  color: #fff;
  font-weight: 700;
  box-shadow: 0 10px 22px color-mix(in srgb, var(--editor-brand) 22%, transparent);
}

.director-primary-btn.wide {
  width: 100%;
}

.director-primary-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.director-inline-status {
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 0.93rem;
  font-weight: 600;
}

.director-inline-status.success {
  background: color-mix(in srgb, #e7f8ee 72%, white);
  color: #1d6f42;
  border: 1px solid #b8e2c6;
}

.director-inline-status.error {
  background: color-mix(in srgb, #fdebed 72%, white);
  color: #8a2a34;
  border: 1px solid #efb7bf;
}

.director-empty {
  border: 1px dashed var(--editor-border-strong);
  border-radius: 12px;
  background: color-mix(in srgb, white 90%, var(--editor-panel) 10%);
  color: var(--editor-text-soft);
  display: grid;
  place-items: center;
  text-align: center;
}

.director-empty.compact {
  min-height: 92px;
  padding: 14px;
}

.director-code-list,
.director-editor-list {
  display: grid;
  gap: 10px;
}

.director-code-list {
  overflow-y: auto;
  padding-right: 4px;
  max-height: 500px;
}

.director-code-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--editor-border);
  background: color-mix(in srgb, white 86%, var(--editor-panel-soft) 14%);
  box-shadow: 0 6px 14px rgba(8, 18, 30, 0.08);
}

.director-code-main {
  display: grid;
  gap: 4px;
}

.director-code-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.director-code-row strong {
  color: var(--editor-brand);
  font-size: 1.1rem;
  letter-spacing: 0.02em;
}

.director-copy-btn {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: color-mix(in srgb, var(--editor-brand) 12%, white);
  color: var(--editor-brand);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.director-copy-btn svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.director-code-meta {
  color: var(--editor-text-soft);
  font-size: 0.86rem;
}

.director-status-pill {
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: lowercase;
}

.director-status-pill.open {
  background: #f7e08a;
  color: #7f5a00;
}

.director-status-pill.expired {
  background: #efb7bf;
  color: #8a2a34;
}

.director-status-pill.used {
  background: #c9e8a8;
  color: #2f6b22;
}

.codes-panel .director-empty.compact {
  min-height: 110px;
}

.editors-panel {
  margin-top: 2px;
}

.director-editor-list {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.director-editor-card {
  padding: 14px;
  border-radius: 12px;
  border: 1px solid var(--editor-border);
  background: color-mix(in srgb, white 90%, var(--editor-panel) 10%);
  display: grid;
  gap: 4px;
  box-shadow: 0 6px 14px rgba(8, 18, 30, 0.06);
}

.director-editor-card strong {
  color: var(--editor-brand);
}

.director-editor-card span,
.director-editor-card small {
  color: var(--editor-text-soft);
}

@media (max-width: 1180px) {
  .director-grid {
    grid-template-columns: 1fr;
  }

  .director-editor-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .director-topbar,
  .director-topbar-actions,
  .director-panel-head.split {
    flex-direction: column;
    align-items: stretch;
  }

  .branding-form-grid,
  .director-editor-list {
    grid-template-columns: 1fr;
  }

  .director-code-card {
    grid-template-columns: 1fr;
  }

  .director-code-row {
    align-items: flex-start;
  }
}
</style>
