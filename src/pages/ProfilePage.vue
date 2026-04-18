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
              <div class="room-meta">Geplaatst: {{ new Date(item.createdAt).toLocaleString('nl-NL') }}</div>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<style src="./styles/home-page.css"></style>
