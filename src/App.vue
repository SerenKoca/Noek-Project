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
import { loginAccount, registerAccount, getStoredAuth, clearAuth } from './services/authService.js'

const view = ref('home')
const rooms = ref([])
const authState = ref(getStoredAuth())
const authEmail = ref('')
const authPassword = ref('')
const authDisplayName = ref('')
const authMode = ref('login')
const authStatus = ref('')
const authStatusType = ref('')
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
  if (!authState.value?.token) {
    rooms.value = []
    return
  }

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
  if (authState.value?.token) {
    loadRooms()
  }
})

async function onAuthSubmit() {
  authStatus.value = ''
  authStatusType.value = ''

  const email = authEmail.value.trim()
  const password = authPassword.value
  const displayName = authDisplayName.value.trim()

  if (!email || !password) {
    authStatus.value = 'Email en wachtwoord zijn verplicht.'
    authStatusType.value = 'error'
    return
  }

  if (authMode.value === 'register' && password.length < 8) {
    authStatus.value = 'Wachtwoord moet minstens 8 tekens hebben.'
    authStatusType.value = 'error'
    return
  }

  authStatus.value = authMode.value === 'register' ? 'Account aanmaken...' : 'Inloggen...'
  authStatusType.value = 'loading'

  try {
    const result = authMode.value === 'register'
      ? await registerAccount({ email, password, displayName })
      : await loginAccount({ email, password })

    authState.value = result
    authPassword.value = ''
    authStatus.value = `Welkom ${result?.user?.displayName || result?.user?.email || ''}`
    authStatusType.value = 'success'
    await loadRooms()
  } catch (error) {
    authStatus.value = error?.response?.data?.error || 'Authenticatie mislukt.'
    authStatusType.value = 'error'
  }
}

function onLogout() {
  clearAuth()
  authState.value = null
  rooms.value = []
  currentRoom.value = null
  currentRoomData.value = null
  view.value = 'home'
  authStatus.value = 'Je bent uitgelogd.'
  authStatusType.value = 'success'
}

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

        <div v-if="!authState?.token" class="auth-panel">
          <h3>{{ authMode === 'register' ? 'Nieuw account' : 'Inloggen' }}</h3>
          <div class="auth-row">
            <input v-model="authEmail" type="email" placeholder="Email" autocomplete="email" />
            <input v-model="authPassword" type="password" placeholder="Wachtwoord" autocomplete="current-password" />
            <input
              v-if="authMode === 'register'"
              v-model="authDisplayName"
              type="text"
              placeholder="Weergavenaam (optioneel)"
              autocomplete="nickname"
            />
          </div>
          <div class="auth-actions">
            <button type="button" class="primary-btn" @click="onAuthSubmit">
              {{ authMode === 'register' ? 'Account aanmaken' : 'Inloggen' }}
            </button>
            <button
              type="button"
              class="secondary-btn"
              @click="authMode = authMode === 'register' ? 'login' : 'register'"
            >
              {{ authMode === 'register' ? 'Ik heb al een account' : 'Nieuwe gebruiker' }}
            </button>
          </div>
          <div v-if="authStatus" class="editor-save-status" :class="authStatusType">{{ authStatus }}</div>
        </div>

        <div v-else class="auth-userbar">
          <span>Ingelogd als <strong>{{ authState.user.displayName }}</strong> ({{ authState.user.email }})</span>
          <button type="button" class="secondary-btn" @click="onLogout">Uitloggen</button>
        </div>

        <div class="home-actions">
          <button type="button" class="primary-btn" :disabled="!authState?.token" @click="openEditor()">✨ Nieuwe kamer</button>
          <button type="button" class="secondary-btn" :disabled="!authState?.token" @click="loadRooms">🔄 Ververs lijst</button>
        </div>
      </div>
      <div class="room-list">
        <div v-if="!authState?.token" class="room-empty">
          <div class="empty-icon">🔐</div>
          <h3>Log eerst in</h3>
          <p>Je kamers zijn alleen zichtbaar voor jouw account.</p>
        </div>
        <div v-else-if="rooms.length === 0" class="room-empty">
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
