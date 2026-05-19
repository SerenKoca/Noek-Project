<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ThreeScene from '../components/ThreeScene.vue'
import { useNoekState } from '../composables/useNoekState.js'

const router = useRouter()
const state = useNoekState()
const createRoomModal = ref(false)
const creatingRoom = ref(false)

import { saveRoom } from '../services/roomService.js'

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

const branding = computed(() => state.brandingState.value || {})
const userLabel = computed(() => {
  const displayName = String(state.authState.value?.user?.displayName || '').trim()
  if (displayName) return displayName

  const email = String(state.authState.value?.user?.email || '').trim()
  if (email) return email.split('@')[0]

  return 'Doris'
})

const userInitial = computed(() => {
  const label = userLabel.value.trim()
  return label ? label.charAt(0).toUpperCase() : 'D'
})

function getRoomUpdatedAt(room) {
  return room?.updatedAt || room?.createdAt || null
}

function formatRelativeDate(value) {
  if (!value) return 'onbekend'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'onbekend'

  const diffMs = Date.now() - date.getTime()
  if (diffMs < 60_000) return 'zojuist'

  const diffDays = Math.max(0, Math.floor(diffMs / 86_400_000))
  if (diffDays <= 0) return 'vandaag'
  if (diffDays === 1) return '1 dag geleden'
  return `${diffDays} dagen geleden`
}

function roomSubtitle(room) {
  return `Bewerkt: ${formatRelativeDate(getRoomUpdatedAt(room))}`
}

function roomCardStyle(room) {
  const appearance = room?.sceneData?.appearance || {}
  return {
    '--room-preview-wall': appearance.wallColor || '#dce8f6',
    '--room-preview-floor': appearance.floorColor || '#d6b78b'
  }
}

function openNotifications() {
  window.alert('Je hebt nog geen nieuwe meldingen.')
}

async function createEmptyRoom() {
  if (state.rooms.value.length >= 2) return
  creatingRoom.value = true
  try {
    const saved = await saveRoom({ name: 'Nieuwe kamer', sceneData: null })
    await state.loadRooms()
    createRoomModal.value = false
    await router.push(`/rooms/${saved._id}/editor`)
  } catch (err) {
    window.alert('Kamer aanmaken mislukt.')
    console.error(err)
  } finally {
    creatingRoom.value = false
  }
}

function openTemplates() {
  createRoomModal.value = false
  router.push('/rooms/create')
}
</script>

<template>
  <div class="editor-page is-home">
    <div class="home-page-v2 editor-home-shell">
      <header class="home-topbar-v2 editor-home-topbar">
        <div class="home-brand-v2 editor-home-brand">
          <div v-if="branding.logoUrl" class="editor-home-brand-logo-wrap">
            <img
              :src="branding.logoUrl"
              alt="Brand logo"
              class="editor-home-brand-logo"
            />
          </div>
          <div v-else class="editor-home-brand-text">
            <strong>{{ branding.directorName || 'Thibaut DELA' }}</strong>
            <span>Uitvaartzorg</span>
          </div>
        </div>

          <div class="editor-home-topbar-actions">
          <button type="button" class="editor-home-user-btn" @click="openProfile" :title="userLabel">
            <span class="editor-home-user-initial">{{ userInitial }}</span>
            <span class="editor-home-user-name">{{ userLabel }}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" class="editor-home-user-icon">
              <path d="M12 12.1a4.2 4.2 0 1 0-4.2-4.2 4.2 4.2 0 0 0 4.2 4.2Zm0 2c-4.4 0-8 2.5-8 5.6v1.2h16v-1.2c0-3.1-3.6-5.6-8-5.6Z" />
            </svg>
          </button>
        </div>
      </header>

      <main class="editor-home-main">
        <section class="editor-home-hero">
          <div class="editor-home-hero-copy">
            <p class="editor-home-kicker">Editor dashboard</p>
            <h1>Hallo {{ userLabel }},</h1>
            <p>We zijn hier om ruimte te bieden voor verdriet en zijn verschillende vormen.</p>
          </div>
        </section>

        <section class="editor-home-rooms">
          <div class="home-main-header-v2 editor-home-rooms-head">
            <h2>Uw kamers:</h2>
            <button
              type="button"
              class="primary-btn editor-home-create-btn"
              :disabled="state.rooms.value.length >= 2"
              :title="state.rooms.value.length >= 2 ? 'Elk account mag maar 2 kamers hebben.' : ''"
              @click="createRoomModal = true"
            >
              + Maak een kamer
            </button>
          </div>

          <p v-if="state.rooms.value.length >= 2" class="room-contribution-empty error editor-home-limit">
            Elk account mag maar 2 kamers hebben.
          </p>

          <div v-if="state.rooms.value.length === 0" class="room-empty editor-home-empty">
            <div class="empty-icon">🏠</div>
            <h3>Nog geen kamers</h3>
            <p>Maak je eerste kamer om te beginnen.</p>
          </div>

          <div v-else class="editor-home-room-list">
            <article v-for="room in state.rooms.value" :key="room._id" class="editor-home-room-card" :style="roomCardStyle(room)">
              <button type="button" class="editor-home-room-main" @click="openEditorRoute(room)">
                <div class="editor-home-room-preview">
                  <ThreeScene
                    v-if="room?.sceneData"
                    class="editor-home-room-scene"
                    :room-data="room.sceneData"
                  />
                  <div v-else class="editor-home-room-fallback">
                    <span>{{ (room.name || 'Kamer').charAt(0).toUpperCase() }}</span>
                  </div>
                </div>

                <div class="editor-home-room-copy">
                  <strong>{{ room.name }}</strong>
                  <div class="editor-home-room-meta">{{ roomSubtitle(room) }}</div>
                  <div class="editor-home-room-link">link kamer</div>
                </div>
              </button>

              <button type="button" class="editor-home-room-delete" @click.stop="state.onDeleteRoom(room)" aria-label="Kamer verwijderen">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 3v1H4v2h16V4h-5V3H9zm-1 6v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9H8z" />
                </svg>
              </button>

              <button type="button" class="editor-home-room-settings" @click.stop="openSettingsRoute(room)" aria-label="Instellingen openen">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19.14 12.94a7.9 7.9 0 0 0 .06-.94 7.9 7.9 0 0 0-.06-.94l2.06-1.61a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.43.98a7.7 7.7 0 0 0-1.63-.94l-.37-2.58A.5.5 0 0 0 13.8 2H10.2a.5.5 0 0 0-.49.43l-.37 2.58a7.7 7.7 0 0 0-1.63.94l-2.43-.98a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.06 1.61a7.9 7.9 0 0 0 0 1.88L2.8 14.55a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.43-.98c.5.38 1.04.7 1.63.94l.37 2.58a.5.5 0 0 0 .49.43h3.6a.5.5 0 0 0 .49-.43l.37-2.58c.59-.24 1.13-.56 1.63-.94l2.43.98a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.06-1.61c.04-.31.06-.62.06-.94s-.02-.63-.06-.94ZM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z" />
                </svg>
              </button>
            </article>
          </div>
        </section>
      </main>

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

      <div v-if="createRoomModal" class="modal-backdrop" @click.self="createRoomModal = false">
        <div class="modal-card" role="dialog" aria-modal="true" aria-label="Kies een ruimte">
          <h3 style="color: var(--editor-text); text-align: center; margin:0 0 8px">Kies een ruimte</h3>
          <div class="choose-grid">
            <button type="button" class="choose-card" @click="createEmptyRoom" :disabled="creatingRoom || state.rooms.value.length >= 2">
              <h4>Lege ruimte</h4>
              <svg viewBox="0 0 24 24"><path d="M3 7h18v10H3z"/></svg>
              <div style="font-size:0.9rem; color: rgba(0,0,0,0.6)">Begin vanaf 0 en ontwerp zelf je kamer</div>
            </button>

            <button type="button" class="choose-card" @click="openTemplates">
              <h4>Templates</h4>
              <svg viewBox="0 0 24 24"><path d="M3 7h18v10H3z"/></svg>
              <div style="font-size:0.9rem; color: rgba(0,0,0,0.6)">Kies een vooraf ontworpen kamer die je zelf kan aanpassen</div>
            </button>
          </div>
          <div class="modal-actions">
            <button type="button" class="secondary-btn" @click="createRoomModal = false">Annuleren</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style src="./styles/home-page.css"></style>
