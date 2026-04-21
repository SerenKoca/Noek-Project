<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNoekState } from '../composables/useNoekState.js'
import { createFuneralDirector, deleteFuneralDirector, getFuneralDirectors } from '../services/adminService.js'

const router = useRouter()
const state = useNoekState()

const loading = ref(true)
const status = ref('')
const error = ref('')
const directors = ref([])
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
    status.value = 'Uitvaartondernemer verwijderd.'
    await loadDirectors()
  } catch (err) {
    error.value = formatApiError(err, 'Verwijderen mislukt.')
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
          <strong>Admin</strong>
          <span>Beheer uitvaartondernemers</span>
        </div>
        <div class="home-user-v2">
          <span>{{ state.authState.value?.user?.displayName || state.authState.value?.user?.email }}</span>
          <span class="role-badge">admin</span>
          <button type="button" class="secondary-btn" @click="logout">Uitloggen</button>
        </div>
      </header>

      <section class="home-main-v2">
        <div class="home-main-header-v2">
          <div>
            <h2>Uitvaartondernemers</h2>
            <p>Maak accounts aan en beheer bestaande uitvaartondernemers.</p>
          </div>
          <div class="home-actions">
            <button type="button" class="secondary-btn" @click="loadDirectors">Ververs</button>
          </div>
        </div>

        <form class="auth-form-v2" @submit.prevent="submitCreateDirector">
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

        <div v-if="loading" class="room-empty">
          <h3>Bezig met laden...</h3>
        </div>

        <div v-else-if="directors.length === 0" class="room-empty">
          <h3>Geen uitvaartondernemers</h3>
          <p>Maak hierboven een eerste account aan.</p>
        </div>

        <div v-else class="room-grid room-grid-v2">
          <article v-for="item in directors" :key="item.id" class="room-card room-card-v2">
            <div class="room-info">
              <strong>{{ item.displayName }}</strong>
              <div class="room-meta">{{ item.email }}</div>
              <div class="room-meta">Aangemaakt: {{ new Date(item.createdAt).toLocaleString('nl-NL') }}</div>
            </div>
            <div class="room-actions-row room-actions-row-v2">
              <button type="button" class="danger-btn" @click="removeDirector(item)">Verwijder</button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<style src="./styles/home-page.css"></style>
<style src="./styles/auth-page.css"></style>
