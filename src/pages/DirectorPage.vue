<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNoekState } from '../composables/useNoekState.js'
import { generateEditorCode, getMyEditorCodes, getMyEditors } from '../services/directorService.js'

const router = useRouter()
const state = useNoekState()

const loading = ref(true)
const error = ref('')
const success = ref('')
const editors = ref([])
const codes = ref([])
const codeLifetimeDays = ref(30)

async function loadDirectorData() {
  loading.value = true
  error.value = ''

  try {
    const [editorList, codeList] = await Promise.all([getMyEditors(), getMyEditorCodes()])
    editors.value = editorList
    codes.value = codeList
  } catch (err) {
    const message = err?.response?.data?.error || 'Kon gegevens niet laden.'
    const code = err?.response?.data?.code
    error.value = code ? `${message} (${code})` : message
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
    const message = err?.response?.data?.error || 'Code genereren mislukt.'
    const code = err?.response?.data?.code
    error.value = code ? `${message} (${code})` : message
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
          <strong>Uitvaartondernemer</strong>
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

<style src="./styles/home-page.css"></style>
<style src="./styles/auth-page.css"></style>
