<script setup>
import { ref, onMounted } from 'vue'
import Sidebar from './components/Sidebar.vue'
import ThreeScene from './components/ThreeScene.vue'
import EditorTopLeftControls from './components/EditorTopLeftControls.vue'
import EditorRoomName from './components/EditorRoomName.vue'
import EditorBrand from './components/EditorBrand.vue'
import EditorHistoryControls from './components/EditorHistoryControls.vue'
import SceneOverlays from './components/SceneOverlays.vue'
import { saveRoom, updateRoom, getRooms } from './services/roomService.js'

const view = ref('home')
const rooms = ref([])
const loadRequest = ref(null)
const selected = ref(null)
const selectedAnchor = ref(null)
const lastLoadError = ref('')
const sceneCommand = ref(null)
const sceneRef = ref(null)
const roomName = ref('Naam kamer')
const saveStatus = ref('')
const saveStatusType = ref('') // 'success', 'error', 'loading', or ''
const currentRoomData = ref(null) // For loading room data into scene
const currentRoom = ref(null) // The current room being edited (for updates)

async function loadRooms() {
  try {
    rooms.value = await getRooms()
  } catch (error) {
    console.error('Failed to load rooms', error)
    rooms.value = []
  }
}

async function openEditor(room = null) {
  console.log('Opening editor for room:', room?.name, room?.sceneData)
  selected.value = null
  selectedAnchor.value = null
  lastLoadError.value = ''
  roomName.value = room?.name || 'Naam kamer'
  view.value = 'editor'
  saveStatus.value = ''
  saveStatusType.value = ''

  // Set current room for updates
  currentRoom.value = room

  console.log('About to set currentRoomData, current value:', currentRoomData.value)
  // Set room data to be loaded when scene is ready
  const roomData = room?.sceneData ? JSON.parse(JSON.stringify(room.sceneData)) : null
  currentRoomData.value = roomData
  console.log('Set currentRoomData.value to:', currentRoomData.value)
}

function showHome() {
  console.log('Going back to home, resetting currentRoomData')
  view.value = 'home'
  saveStatus.value = ''
  saveStatusType.value = ''
  currentRoomData.value = null
  currentRoom.value = null
}

onMounted(() => {
  loadRooms()
})

function onLoadModel(modelLike) {
  // Ensure watch triggers even if the same item is loaded twice.
  loadRequest.value = { ...modelLike, _requestId: Date.now() }
}

function onDeleteSelected() {
  sceneCommand.value = { type: 'delete-selected', _requestId: Date.now() }
}

function onSelected(info) {
  selected.value = info
}

function onSelectedAnchor(anchor) {
  selectedAnchor.value = anchor
}

function onLoadError(message) {
  lastLoadError.value = message || 'Failed to load model.'
  window.setTimeout(() => {
    if (lastLoadError.value === message) lastLoadError.value = ''
  }, 6000)
}

async function onSave() {
  if (!sceneRef.value?.serializeRoom) {
    saveStatus.value = 'Scene is niet klaar om op te slaan.'
    saveStatusType.value = 'error'
    return
  }

  const sceneData = sceneRef.value.serializeRoom()
  const name = roomName.value?.trim() || window.prompt('Geef je kamer een naam', 'Mijn kamer')

  if (!name) {
    saveStatus.value = 'Kamernaam is verplicht.'
    saveStatusType.value = 'error'
    return
  }

  roomName.value = name
  saveStatus.value = 'Bezig met opslaan...'
  saveStatusType.value = 'loading'

  try {
    let saved
    if (currentRoom.value) {
      // Update existing room
      saved = await updateRoom(currentRoom.value._id, { name, sceneData })
    } else {
      // Create new room
      saved = await saveRoom({ name, sceneData })
    }
    saveStatus.value = `✅ Kamer "${saved.name || 'naamloos'}" is succesvol opgeslagen!`
    saveStatusType.value = 'success'
    await loadRooms()

    // Update current room reference if it was a new room
    if (!currentRoom.value) {
      currentRoom.value = saved
    }

    // Laat succesmelding 5 seconden zien
    setTimeout(() => {
      if (saveStatusType.value === 'success') {
        saveStatus.value = ''
        saveStatusType.value = ''
      }
    }, 5000)
  } catch (error) {
    console.error('Failed to save room', error)
    saveStatus.value = `❌ Opslaan mislukt: ${error?.response?.data?.error || error?.message || 'Onbekende fout'}`
    saveStatusType.value = 'error'

    // Laat foutmelding 8 seconden zien
    setTimeout(() => {
      if (saveStatusType.value === 'error') {
        saveStatus.value = ''
        saveStatusType.value = ''
      }
    }, 8000)
  }
}

function onToolbarAction() {
  // Placeholder for toolbar actions while behavior is being defined.
}

function handleRoomNameUpdate(value) {
  roomName.value = value
}

function onHistoryAction() {
  // Placeholder for undo/redo actions while behavior is being defined.
}
</script>

<template>
  <div class="editor-page">
    <div v-if="view === 'home'" class="home-page">
      <div class="home-header">
        <h1>🏠 Noek Kamer Editor</h1>
        <p>Maak en bewerk je virtuele kamers. Klik op een kamer om verder te werken, of maak een nieuwe.</p>
        <div class="home-actions">
          <button type="button" class="primary-btn" @click="openEditor()">✨ Nieuwe kamer</button>
          <button type="button" class="secondary-btn" @click="loadRooms">🔄 Ververs lijst</button>
        </div>
      </div>
      <div class="room-list">
        <div v-if="rooms.length === 0" class="room-empty">
          <div class="empty-icon">📭</div>
          <h3>Geen kamers gevonden</h3>
          <p>Maak je eerste kamer om te beginnen!</p>
        </div>
        <div v-else class="room-grid">
          <button
            v-for="room in rooms"
            :key="room._id"
            type="button"
            class="room-card"
            @click="openEditor(room)"
          >
            <div class="room-icon">🏠</div>
            <div class="room-info">
              <strong>{{ room.name }}</strong>
              <div class="room-meta">{{ new Date(room.createdAt).toLocaleString('nl-NL') }}</div>
            </div>
          </button>
        </div>
      </div>
    </div>

    <div v-else class="editor-shell">
      <button type="button" class="home-icon-btn" @click="showHome" title="Terug naar home">
        🏠
      </button>

      <EditorTopLeftControls
        @settings="onToolbarAction"
        @home="onToolbarAction"
        @save="onSave"
        @share="onToolbarAction"
      />

      <EditorRoomName
        :room-name="roomName.value"
        @update:roomName="handleRoomNameUpdate"
      />

      <div class="editor-save-status" :class="saveStatusType" v-if="saveStatus">
        {{ saveStatus }}
      </div>

      <EditorBrand name="Thibaut DELA" sub="Uitvaartzorg" />

      <EditorHistoryControls @undo="onHistoryAction" @redo="onHistoryAction" />

      <div class="editor-content">
        <Sidebar
          class="editor-sidebar"
          :selected="selected"
          @load-model="onLoadModel"
          @delete-selected="onDeleteSelected"
        />

        <div class="editor-scene-panel">
          <ThreeScene
            ref="sceneRef"
            class="editor-scene"
            :load-request="loadRequest"
            :scene-command="sceneCommand"
            :room-data="currentRoomData"
            @selected="onSelected"
            @selected-anchor="onSelectedAnchor"
            @load-error="onLoadError"
          />

          <SceneOverlays
            :error-message="lastLoadError"
            :selected="selected"
            :selected-anchor="selectedAnchor"
            @delete-selected="onDeleteSelected"
          />
        </div>
      </div>
    </div>
  </div>
</template>
