<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Sidebar from '../components/Sidebar.vue'
import ThreeScene from '../components/ThreeScene.vue'
import EditorTopLeftControls from '../components/EditorTopLeftControls.vue'
import EditorRoomName from '../components/EditorRoomName.vue'
import EditorBrand from '../components/EditorBrand.vue'
import EditorHistoryControls from '../components/EditorHistoryControls.vue'
import SceneOverlays from '../components/SceneOverlays.vue'
import ShareSuccessModal from '../components/ShareSuccessModal.vue'
import { useNoekState } from '../composables/useNoekState.js'

const route = useRoute()
const router = useRouter()
const state = useNoekState()
const showRoomReactions = false
const showShareModal = ref(false)
const shareRoomData = ref({ roomName: '', visitUrl: '', directorName: '' })
let autoSaveIntervalId = null
let desktopViewportQuery = null
const TEMPLATE_OWNER_EMAIL = String(import.meta.env.VITE_ROOM_TEMPLATE_OWNER_EMAIL || 'editor@test.be').trim().toLowerCase()
const EDITOR_DESKTOP_MIN_WIDTH = 1024
const canEditTemplate = computed(() => {
  const email = String(state.authState.value?.user?.email || '').trim().toLowerCase()
  return email === TEMPLATE_OWNER_EMAIL
})

function isEditorDesktopViewport() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true
  }

  return window.matchMedia(`(min-width: ${EDITOR_DESKTOP_MIN_WIDTH}px)`).matches
}

async function redirectToHomeForMobileEditor() {
  window.alert('De editor is alleen beschikbaar op desktop.')
  state.showHome()
  await router.replace('/home')
}

function handleDesktopViewportChange(event) {
  if (event.matches) return

  stopAutoSave()
  redirectToHomeForMobileEditor()
}

onMounted(async () => {
  await state.bootstrap()
  if (!state.authState.value?.token) {
    await router.replace('/login')
    return
  }

  if (!isEditorDesktopViewport()) {
    await redirectToHomeForMobileEditor()
    return
  }

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    desktopViewportQuery = window.matchMedia(`(min-width: ${EDITOR_DESKTOP_MIN_WIDTH}px)`)
    desktopViewportQuery.addEventListener('change', handleDesktopViewportChange)
  }

  const roomId = String(route.params.id || '')
  if (roomId === 'new') {
    await state.openEditor(null)
    startAutoSave()
    return
  }

  if (state.rooms.value.length === 0) {
    await state.loadRooms()
  }

  const room = state.getRoomById(roomId)
  if (!room) {
    await router.replace('/home')
    return
  }

  await state.openEditor(room)
  startAutoSave()
})

onBeforeUnmount(() => {
  if (desktopViewportQuery) {
    desktopViewportQuery.removeEventListener('change', handleDesktopViewportChange)
    desktopViewportQuery = null
  }

  stopAutoSave()
})

function startAutoSave() {
  stopAutoSave()
  autoSaveIntervalId = window.setInterval(() => {
    state.onSave({ source: 'autosave' })
  }, 10000)
}

function stopAutoSave() {
  if (!autoSaveIntervalId) return
  window.clearInterval(autoSaveIntervalId)
  autoSaveIntervalId = null
}

async function backToHome() {
  state.showHome()
  await router.push('/home')
}

function buildVisitUrl(roomId) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/visit/${roomId}`
}

async function shareCurrentRoom() {
  const roomId = state.currentRoom.value?._id || String(route.params.id || '')
  if (!roomId || roomId === 'new') {
    window.alert('Sla de kamer eerst op voor je een deelbare link kan maken.')
    return
  }

  const visitUrl = buildVisitUrl(roomId)
  const roomName = state.currentRoom.value?.name || 'deze kamer'
  const directorName = state.brandingState.value?.directorName || 'Thibaut DELA'

  shareRoomData.value = {
    roomName,
    visitUrl,
    directorName,
  }
  showShareModal.value = true
}

async function openSettings() {
  const roomId = state.currentRoom.value?._id || String(route.params.id || '')
  if (!roomId) return
  await state.openRoomSettings(state.currentRoom.value || state.getRoomById(roomId))
  await router.push(`/rooms/${roomId}/settings`)
}
</script>

<template>
  <div class="editor-page is-editor">
    <div class="editor-shell">
      <EditorTopLeftControls
        @settings="openSettings"
        @home="backToHome"
        @save="state.onSave"
        @share="shareCurrentRoom"
      />

      <EditorRoomName
        :room-name="state.roomName.value"
        @update:roomName="state.handleRoomNameUpdate"
      />

      <div class="editor-save-status" :class="state.saveStatusType.value" v-if="state.saveStatus.value">
        {{ state.saveStatus.value }}
      </div>

      <EditorBrand
        :name="state.brandingState.value?.directorName || 'Noek'"
        sub="Uitvaartzorg"
        :logo-url="state.brandingState.value?.logoUrl || ''"
      />

      <EditorHistoryControls @undo="state.onHistoryAction" @redo="state.onHistoryAction" />

      <section class="editor-room-sound-bar">
        <div class="editor-room-sound-title">{{ state.currentRoomSoundTitle.value }}</div>
        <div class="editor-room-sound-controls">
          <label class="editor-room-range compact centered horizontal">
            <span class="editor-room-range-label">Volume</span>
            <input v-model.number="state.roomMusicDraftVolume.value" type="range" min="0" max="100" step="1" @input="state.onRoomMusicVolumeInput" />
            <span>{{ state.roomMusicDraftVolume.value }}%</span>
          </label>
          <button type="button" class="secondary-btn compact-btn" :disabled="state.roomMusicState.value.loading" @click="state.onSaveRoomMusic">
            {{ state.roomMusicState.value.loading ? 'Opslaan...' : 'Toepassen' }}
          </button>
        </div>
        <div v-if="state.roomMusicState.value.error" class="room-contribution-empty error">{{ state.roomMusicState.value.error }}</div>
      </section>

      <aside v-if="showRoomReactions" class="editor-room-side-panel">
        <section class="editor-room-widget">
          <h4>Reacties op deze kamer</h4>
          <div class="item-reactions-row">
            <button
              type="button"
              class="reaction-chip"
              :class="{ active: state.getUserRoomReaction(state.currentRoom.value) === 'heart' }"
              @click="state.reactOnRoom('heart')"
            >
              ❤️ {{ state.currentRoom.value?.roomReactions?.heartCount || 0 }}
            </button>
            <button
              type="button"
              class="reaction-chip"
              :class="{ active: state.getUserRoomReaction(state.currentRoom.value) === 'support' }"
              @click="state.reactOnRoom('support')"
            >
              🤍 {{ state.currentRoom.value?.roomReactions?.supportCount || 0 }}
            </button>
            <button
              type="button"
              class="reaction-chip"
              :class="{ active: state.getUserRoomReaction(state.currentRoom.value) === 'candle' }"
              @click="state.reactOnRoom('candle')"
            >
              🕯️ {{ state.currentRoom.value?.roomReactions?.candleCount || 0 }}
            </button>
          </div>

          <form class="item-comment-form" @submit.prevent="state.submitRoomComment">
            <input
              v-model="state.roomCommentDraft.value"
              type="text"
              maxlength="500"
              placeholder="Laat een reactie achter voor de hele kamer..."
            />
            <button type="submit" class="secondary-btn" :disabled="state.roomCommentState.value.loading">
              {{ state.roomCommentState.value.loading ? 'Bezig...' : 'Plaats reactie' }}
            </button>
          </form>

          <div v-if="state.roomCommentState.value.error" class="room-contribution-empty error">
            {{ state.roomCommentState.value.error }}
          </div>

          <ul class="item-comments-items" v-if="(state.currentRoom.value?.roomComments || []).length">
            <li
              v-for="comment in state.currentRoom.value.roomComments"
              :key="comment._id || comment.createdAt"
              class="item-comment-entry"
            >
              <span class="item-comment-author">{{ comment.displayName || 'Gebruiker' }}:</span>
              <span>{{ comment.text }}</span>
            </li>
          </ul>
          <div v-else class="room-contribution-empty">Nog geen reacties op de kamer.</div>
        </section>
      </aside>

      <div class="editor-content">
        <Sidebar
          class="editor-sidebar"
          :selected="state.selected.value"
          :room-appearance="state.roomAppearanceDraft.value"
          @load-model="state.onLoadModel"
          @delete-selected="state.onDeleteSelected"
          @select-sound="state.onSelectRoomSound"
          @apply-room-colors="state.onApplyRoomColors"
        />

        <div class="editor-scene-panel">
          <ThreeScene
            :ref="(el) => { state.sceneRef.value = el }"
            class="editor-scene"
            :load-request="state.loadRequest.value"
            :scene-command="state.sceneCommand.value"
            :room-data="state.currentRoomData.value"
            :can-edit-template="canEditTemplate"
            :admin-mode="false"
            @selected="state.onSelected"
            @selected-anchor="state.onSelectedAnchor"
            @load-error="state.onLoadError"
          />

          <SceneOverlays
            :error-message="state.lastLoadError.value"
            :selected="state.selected.value"
            :selected-anchor="state.selectedAnchor.value"
            @delete-selected="state.onDeleteSelected"
          />
        </div>
      </div>
    </div>

    <ShareSuccessModal
      v-if="showShareModal"
      :room-name="shareRoomData.roomName"
      :visit-url="shareRoomData.visitUrl"
      :director-name="shareRoomData.directorName"
      @close="showShareModal = false"
    />
  </div>
</template>

<style src="./styles/editor-page.css"></style>
