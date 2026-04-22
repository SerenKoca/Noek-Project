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
    <div class="home-page-v2">
      <header class="home-topbar-v2">
        <div class="home-brand-v2">
          <img
            v-if="branding.logoUrl"
            :src="branding.logoUrl"
            alt="Brand logo"
            style="height: 40px; max-width: 180px; object-fit: contain;"
          />
          <strong v-else>{{ branding.directorName || 'Uitvaartondernemer' }}</strong>
          <span>Klanten en editorcodes</span>
        </div>
        <div class="home-user-v2">
          <span>{{ state.authState.value?.user?.displayName || state.authState.value?.user?.email }}</span>
          <span class="role-badge">funeral_director</span>
          <button type="button" class="secondary-btn" @click="logout">Uitloggen</button>
        </div>
      </header>

      <section class="home-main-v2">
        <div class="home-main-header-v2">
          <div>
            <h2>Editor registratiecodes</h2>
            <p>Genereer codes en geef ze aan klanten zodat ze editor-account kunnen maken.</p>
          </div>
          <div class="home-actions">
            <button type="button" class="secondary-btn" @click="loadDirectorData">Ververs</button>
          </div>
        </div>

        <div class="room-actions-row room-actions-row-v2" style="margin-bottom: 16px;">
          <input v-model.number="codeLifetimeDays" type="number" min="1" max="365" class="auth-field-v2" style="max-width: 190px;" />
          <button type="button" class="primary-btn" @click="createCode">Genereer editorcode</button>
        </div>

        <section class="editor-room-widget" style="margin-bottom: 16px;">
          <h3 style="margin-top: 0;">Jouw branding</h3>
          <p class="room-meta" style="margin-top: 0;">Deze kleuren en dit logo gelden voor jouw dashboard, je editors en bezoekers van jullie kamers.</p>

          <div class="room-actions-row room-actions-row-v2" style="align-items: flex-end; gap: 12px; margin-bottom: 12px;">
            <label class="auth-field-v2" style="max-width: 230px;">
              <span>Donkere kleur</span>
              <input v-model="branding.darkColor" type="color" />
            </label>
            <label class="auth-field-v2" style="max-width: 230px;">
              <span>Lichtere kleur</span>
              <input v-model="branding.lightColor" type="color" />
            </label>
          </div>

          <label class="auth-field-v2" style="margin-bottom: 10px;">
            <span>Logo bestand (png/jpg/webp)</span>
            <input type="file" accept="image/*" @change="onLogoFileChange" />
          </label>

          <label class="auth-field-v2" style="margin-bottom: 12px;">
            <span>Of logo URL</span>
            <input v-model="branding.logoUrl" type="url" placeholder="https://..." />
          </label>

          <div v-if="branding.logoUrl" style="margin-bottom: 12px;">
            <img :src="branding.logoUrl" alt="Logo preview" style="max-height: 68px; max-width: 220px; object-fit: contain; border-radius: 8px; border: 1px solid rgba(0,0,0,0.12); background: #fff;" />
          </div>

          <button type="button" class="primary-btn" :disabled="brandingState.saving" @click="saveBranding">
            {{ brandingState.uploading ? 'Logo uploaden...' : brandingState.saving ? 'Opslaan...' : 'Branding opslaan' }}
          </button>
        </section>

        <div v-if="success" class="auth-status-v2 success">{{ success }}</div>
        <div v-if="error" class="auth-status-v2 error">{{ error }}</div>

        <div v-if="loading" class="room-empty">
          <h3>Bezig met laden...</h3>
        </div>

        <template v-else>
          <h3 style="margin-top: 10px;">Recente codes</h3>
          <div v-if="codes.length === 0" class="room-empty">
            <p>Nog geen codes aangemaakt.</p>
          </div>
          <div v-else class="room-grid room-grid-v2">
            <article v-for="item in codes" :key="item.id" class="room-card room-card-v2">
              <div class="room-info">
                <strong>{{ item.code }}</strong>
                <div class="room-meta">Aangemaakt: {{ new Date(item.createdAt).toLocaleString('nl-NL') }}</div>
                <div class="room-meta">Vervalt: {{ item.expiresAt ? new Date(item.expiresAt).toLocaleString('nl-NL') : '-' }}</div>
                <div class="room-meta">Status: {{ item.usedAt ? 'Gebruikt' : 'Beschikbaar' }}</div>
              </div>
            </article>
          </div>

          <h3 style="margin-top: 24px;">Mijn klanten (editors)</h3>
          <div v-if="editors.length === 0" class="room-empty">
            <p>Nog geen gekoppelde editors.</p>
          </div>
          <div v-else class="room-grid room-grid-v2">
            <article v-for="item in editors" :key="item.id" class="room-card room-card-v2">
              <div class="room-info">
                <strong>{{ item.displayName }}</strong>
                <div class="room-meta">{{ item.email }}</div>
                <div class="room-meta">Aangemaakt: {{ new Date(item.createdAt).toLocaleString('nl-NL') }}</div>
              </div>
            </article>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>
