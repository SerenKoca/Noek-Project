<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNoekState } from '../composables/useNoekState.js'

const router = useRouter()
const state = useNoekState()

onMounted(async () => {
  await state.bootstrap()
  if (!state.authState.value?.token) {
    await router.replace('/login')
    return
  }
  await state.loadRooms()
})

async function openEditorRoute(room) {
  if (!room && state.rooms.value.length >= 2) {
    return
  }

  await state.openEditor(room || null)
  if (room?._id) {
    await router.push(`/rooms/${room._id}/editor`)
    return
  }
  await router.push('/rooms/new/editor')
}

async function openSettingsRoute(room) {
  await state.openRoomSettings(room)
  await router.push(`/rooms/${room._id}/settings`)
}

async function logout() {
  state.onLogout()
  await router.replace('/login')
}

async function openProfile() {
  await router.push('/profile')
}

function buildVisitUrl(roomId) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/visit/${roomId}`
}

async function copyVisitLink(room) {
  if (!room?._id) return
  const visitUrl = buildVisitUrl(room._id)

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(visitUrl)
    } else {
      window.prompt('Kopieer deze link', visitUrl)
      return
    }
    window.alert('Publieke link gekopieerd.')
  } catch {
    window.prompt('Kopieer deze link', visitUrl)
  }
}
</script>

<template>
  <div class="editor-page is-home">
    <div class="home-page-v2">
      <header class="home-topbar-v2">
        <div class="home-brand-v2">
          <strong>Thibaut DELA</strong>
          <span>Uitvaartzorg</span>
        </div>
        <div class="home-user-v2">
          <span>{{ state.authState.value?.user?.displayName || state.authState.value?.user?.email }}</span>
          <span class="role-badge">{{ state.authState.value?.user?.role || 'editor' }}</span>
          <button type="button" class="secondary-btn" @click="openProfile">Profiel</button>
          <button type="button" class="secondary-btn" @click="logout">Uitloggen</button>
        </div>
      </header>

      <section class="home-main-v2">
        <div class="home-main-header-v2">
          <div>
            <h2>Jouw kamers</h2>
            <p>Klik op een kamer om te openen, of ga via instellingen naar alle bijdragen.</p>
          </div>
          <div class="home-actions">
            <button
              type="button"
              class="primary-btn"
              :disabled="state.rooms.value.length >= 2"
              :title="state.rooms.value.length >= 2 ? 'Elk account mag maar 2 kamers hebben.' : ''"
              @click="openEditorRoute(null)"
            >
              Nieuwe kamer
            </button>
            <button type="button" class="secondary-btn" @click="state.loadRooms">Ververs</button>
          </div>
        </div>

        <p v-if="state.rooms.value.length >= 2" class="room-contribution-empty error">
          Elk account mag maar 2 kamers hebben.
        </p>

        <div v-if="state.rooms.value.length === 0" class="room-empty">
          <div class="empty-icon">📭</div>
          <h3>Nog geen kamers</h3>
          <p>Maak je eerste kamer om te beginnen.</p>
        </div>

        <div v-else class="room-grid room-grid-v2">
          <article v-for="room in state.rooms.value" :key="room._id" class="room-card room-card-v2">
            <button type="button" class="room-main-btn" @click="openEditorRoute(room)">
              <div class="room-icon">🏠</div>
              <div class="room-info">
                <strong>{{ room.name }}</strong>
                <div class="room-meta">Aangemaakt: {{ new Date(room.createdAt).toLocaleString('nl-NL') }}</div>
              </div>
            </button>

            <div class="room-actions-row room-actions-row-v2">
              <button type="button" class="secondary-btn" @click="openSettingsRoute(room)">Instellingen</button>
              <button type="button" class="primary-btn" @click="openEditorRoute(room)">Open kamer</button>
              <button type="button" class="secondary-btn" @click="copyVisitLink(room)">Kopieer link</button>
              <button type="button" class="danger-btn" @click="state.onDeleteRoom(room)">Verwijder</button>
            </div>
          </article>
        </div>
      </section>

      <div v-if="state.deleteRoomModal.value.open" class="modal-backdrop" @click.self="state.closeDeleteRoomModal">
        <div class="modal-card" role="dialog" aria-modal="true" aria-label="Kamer verwijderen bevestigen">
          <h3>Kamer verwijderen</h3>
          <p>
            Typ exact deze kamernaam om te bevestigen:
            <strong>{{ state.deleteRoomModal.value.roomName }}</strong>
          </p>
          <input
            v-model="state.deleteRoomModal.value.typedName"
            type="text"
            :placeholder="state.deleteRoomModal.value.roomName"
            autocomplete="off"
          />
          <div v-if="state.deleteRoomModal.value.error" class="room-contribution-empty error">
            {{ state.deleteRoomModal.value.error }}
          </div>
          <div class="modal-actions">
            <button type="button" class="secondary-btn" :disabled="state.deleteRoomModal.value.loading" @click="state.closeDeleteRoomModal">
              Annuleren
            </button>
            <button type="button" class="danger-btn" :disabled="state.deleteRoomModal.value.loading" @click="state.confirmDeleteRoomFromModal">
              {{ state.deleteRoomModal.value.loading ? 'Verwijderen...' : 'Definitief verwijderen' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style src="./styles/home-page.css"></style>
