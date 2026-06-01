<script setup>
import { ref, onMounted, computed } from 'vue'
import CopyToast from '../components/CopyToast.vue'
import ContributionsOverlay from '../components/ContributionsOverlay.vue'
import { useRouter, useRoute } from 'vue-router'
import ThreeScene from '../components/ThreeScene.vue'
import EditorBrand from '../components/EditorBrand.vue'
import { getRoomTemplate, saveRoom, updateRoom } from '../services/roomService.js'
import { useNoekState } from '../composables/useNoekState.js'

const router = useRouter()
const state = useNoekState()

const branding = computed(() => state.brandingState.value || {})
const userLabel = computed(() => {
  const displayName = String(state.authState.value?.user?.displayName || '').trim()
  if (displayName) return displayName
  const email = String(state.authState.value?.user?.email || '').trim()
  if (email) return email.split('@')[0]
  return 'Doris'
})
const userInitial = computed(() => { const label = userLabel.value.trim(); return label ? label.charAt(0).toUpperCase() : 'D' })

const templateScene = ref(null)
const roomName = ref('Naam kamer')
const collaboratorsEnabled = ref(false)
const editLink = ref('')
const editLinkLoading = ref(false)
const editLinkError = ref('')
const editLinkCopied = ref(false)
const editLinkCopyMessage = ref('Link gekopieerd.')
let editLinkCopyTimer = null
const creating = ref(false)
const showContributions = ref(false)
const route = useRoute()
const roomId = computed(() => String(route.params.id || ''))

function syncRoomNameFromRoom(room) {
  const name = String(room?.name || '').trim() || 'Naam kamer'
  roomName.value = name
  state.handleRoomNameUpdate(name)
}

onMounted(async () => {
  await state.bootstrap()
  const editKey = String(route.query.editKey || '').trim()
  if (editKey) {
    state.setRoomEditKey(editKey)
  } else {
    state.clearRoomEditKey()
  }
  try {
    const res = await getRoomTemplate({ skipLoader: true })
    templateScene.value = res?.sceneData || null
  } catch (e) {
    templateScene.value = null
  }

  const room = await state.loadRoomById(roomId.value, { skipLoader: true })
  syncRoomNameFromRoom(room)
  if (room?.editKey) {
    editLink.value = `${window.location.origin}/rooms/${roomId.value}/editor?editKey=${encodeURIComponent(room.editKey)}`
  } else if (state.authState.value?.token) {
    await generateEditLink()
  }
})

async function saveRoomName() {
  const nextName = String(roomName.value || '').trim()
  if (!nextName) {
    window.alert('Geef eerst een kamernaam op.')
    return
  }

  state.handleRoomNameUpdate(nextName)

  if (!roomId.value) {
    state.saveStatus.value = 'Kamer opslaan mislukt: geen kamer geselecteerd.'
    state.saveStatusType.value = 'error'
    return
  }

  state.saveStatus.value = 'Naam wordt opgeslagen...'
  state.saveStatusType.value = 'loading'

  try {
    const saved = await updateRoom(roomId.value, { name: nextName })
    state.saveStatus.value = `Kamer "${saved?.name || nextName}" is succesvol opgeslagen!`
    state.saveStatusType.value = 'success'
    await state.loadRooms({ skipLoader: true })
    await state.loadRoomById(roomId.value, { skipLoader: true })
  } catch (error) {
    console.error('Room name save failed', error)
    state.saveStatus.value = error?.response?.data?.error || 'Kamernaam opslaan mislukt.'
    state.saveStatusType.value = 'error'
  }
}

async function generateEditLink() {
  const id = roomId.value
  if (!id) return

  editLinkLoading.value = true
  editLinkError.value = ''

  try {
    editLink.value = await state.createEditLinkForRoom(id)
  } catch (error) {
    console.error('Failed to create edit link', error)
    editLinkError.value = error?.response?.data?.error || 'Bewerklink maken mislukt.'
  } finally {
    editLinkLoading.value = false
  }
}

async function copyEditLink() {
  if (!editLink.value || !navigator?.clipboard?.writeText) return
  await navigator.clipboard.writeText(editLink.value)
  editLinkCopied.value = true
  editLinkCopyMessage.value = 'Bewerklink gekopieerd.'
  if (editLinkCopyTimer) {
    window.clearTimeout(editLinkCopyTimer)
  }
  editLinkCopyTimer = window.setTimeout(() => {
    editLinkCopied.value = false
  }, 2200)
}

async function createFromTemplate() {
  if (!state.authState.value?.token) {
    window.alert('Inloggen is vereist om een nieuwe kamer aan te maken.')
    return
  }

  if (creating.value) return
  creating.value = true
  try {
    const saved = await saveRoom({
      name: roomName.value || 'Nieuwe kamer',
      sceneData: JSON.parse(JSON.stringify(templateScene.value))
    })
    await state.loadRooms()
    await router.push(`/rooms/${saved._id}/editor`)
  } catch (err) {
    console.error(err)
    window.alert('Kamer aanmaken mislukt.')
  } finally {
    creating.value = false
  }
}

function goBack() {
  const id = roomId.value || ''
  if (!id) {
    router.push('/home')
    return
  }
  const editKey = String(route.query.editKey || '').trim()
  router.push({
    path: `/rooms/${id}/editor`,
    query: editKey ? { editKey } : {}
  })
}

function openProfile() {
  router.push('/profile')
}

function openContributions() { showContributions.value = true }
function closeContributions() { showContributions.value = false }
</script>

<template>
  <div class="editor-page is-home">
    <header class="home-topbar-v2 editor-home-topbar">
      <div class="home-brand-v2 editor-home-brand">
        <div v-if="branding.logoUrl" class="editor-home-brand-logo-wrap">
          <img :src="branding.logoUrl" alt="Brand logo" class="editor-home-brand-logo" />
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
          <svg viewBox="0 0 24 24" aria-hidden="true" class="editor-home-user-icon"><path d="M12 12.1a4.2 4.2 0 1 0-4.2-4.2 4.2 4.2 0 0 0 4.2 4.2Zm0 2c-4.4 0-8 2.5-8 5.6v1.2h16v-1.2c0-3.1-3.6-5.6-8-5.6Z"/></svg>
        </button>
      </div>
    </header>

    <div class="settings-page-v2 create-room-v2 editor-home-shell">
      <header class="settings-header-v2">
        <h1>Instellingen kamer</h1>
      </header>

      <section class="settings-content-v2 two-column">
        <div class="settings-left-v2 left-column">
          <input v-model="roomName" class="create-room-name big" placeholder="Naam kamer" />
          <button type="button" class="primary-btn wide name-save-btn" @click="saveRoomName">Naam opslaan</button>
          <div v-if="state.saveStatus.value" class="save-status" :class="state.saveStatusType.value">
            {{ state.saveStatus.value }}
          </div>

          <div class="preview-shell large">
            <ThreeScene v-if="templateScene" :room-data="templateScene" />
            <div v-else class="room-empty compact-empty">Geen preview beschikbaar</div>
          </div>
        </div>

        <div class="settings-right-v2 right-column">
          <h3 class="settings-title">Instellingen kamer</h3>
          <div class="setting-row spaced">
            <div>
              <div class="setting-label">Samenwerken</div>
              <div class="setting-sub">Nodig mensen uit om mee je kamer te bewerken</div>
            </div>
            <div class="switch-wrap">
              <label class="switch">
                <input type="checkbox" v-model="collaboratorsEnabled" />
                <span class="slider" />
              </label>
              <div class="switch-text">{{ collaboratorsEnabled ? 'Aan' : 'Uit' }}</div>
            </div>
          </div>

          <div class="collaborators-card" v-show="collaboratorsEnabled">
            <div class="edit-link-card inside-toggle">
              <div class="edit-link-header">
                <div>
                  <div class="setting-label">Bewerklink</div>
                  <div class="setting-sub">Deel deze link met iemand die de kamer zonder account mag aanpassen</div>
                </div>
              </div>

              <div v-if="editLink" class="edit-link-row">
                <input type="text" class="edit-link-input" :value="editLink" readonly />
                <button type="button" class="primary-btn small" @click="copyEditLink">
                  {{ editLinkCopied ? 'Gekopieerd' : 'Kopiëren' }}
                </button>
              </div>

              <div v-else class="setting-sub">
                {{ editLinkLoading ? 'Bewerklink wordt geladen...' : 'Bewerklink verschijnt hier automatisch.' }}
              </div>

              <div v-if="editLinkError" class="edit-link-error">{{ editLinkError }}</div>
            </div>
          </div>

          <button type="button" class="primary-btn wide" style="margin-top:18px" @click="openContributions">Bekijk bijdrages van de kamer</button>

          <div class="bottom-actions">
            <button type="button" class="text-back" @click="goBack">Terug</button>
            <button type="button" class="primary-btn big" @click="goBack">Terug naar kamer</button>
          </div>
        </div>
      </section>
    </div>
  </div>
  <ContributionsOverlay v-if="showContributions" :roomId="roomId" @close="closeContributions" />
  <CopyToast :visible="editLinkCopied" :message="editLinkCopyMessage" />
</template>

<style scoped>
.create-room-name {
  width: 100%;
  padding: 22px 18px;
  font-size: 2rem;
  border-radius: 12px;
  border: 1px solid var(--editor-border);
  background: color-mix(in srgb, white 92%, var(--editor-panel) 8%);
  margin-bottom: 18px;
}
.create-room-name.big {
  width: 100%;
  max-width: 680px;
  font-size: 2.6rem;
  padding: 22px 24px;
  background: color-mix(in srgb, var(--brand-light, #d7ebff) 60%, white);
  border-radius: 14px;
  box-shadow: none;
}
.name-save-btn {
  max-width: 280px;
  align-self: flex-start;
}
.save-status {
  max-width: 680px;
  padding: 10px 14px;
  border-radius: 10px;
  font-weight: 600;
  background: color-mix(in srgb, var(--brand-light, #d7ebff) 55%, white);
  color: var(--editor-text, #1e2b37);
}
.save-status.error {
  background: color-mix(in srgb, #ffd7de 60%, white);
  color: #8a2431;
}
.save-status.success {
  background: color-mix(in srgb, var(--brand-light, #d7ebff) 70%, white);
}
.preview-shell {
  border-radius: 12px;
  background: rgba(255,255,255,0.9);
  padding: 18px;
  border: 1px solid var(--editor-border);
  min-height: 320px;
}
.preview-shell.large { min-height: 360px; display:flex; align-items:center; justify-content:center }
.collaborators-card { background: #eef8ff; padding: 16px; border-radius: 12px; margin-top: 12px }
.collaborator-top { display:flex; justify-content:space-between; align-items:flex-start }
.collab-name { font-weight:600 }
.collab-email { font-size:0.9rem; color: #345 }
.collaborator-add { display:flex; gap:8px; margin-top:12px }
.collaborator-add input { flex:1; padding:10px; border-radius:8px; border:1px solid var(--editor-border) }
.switch { display:inline-block }
.switch input { display:none }
.slider { display:inline-block; width:56px; height:30px; background:#dfe8f3; border-radius:999px; position:relative }
.slider::after { content:''; position:absolute; width:22px; height:22px; border-radius:50%; background:#fff; top:4px; left:4px; box-shadow:0 2px 6px rgba(8,63,115,0.12); transition:left 0.18s }
.switch input:checked + .slider { background: var(--editor-brand) }
.switch input:checked + .slider::after { left:30px }
.switch-wrap { display:flex; align-items:center; gap:10px }
.switch-text { font-size:0.95rem; color:#2b4b6b }
.settings-title { margin-top:0; margin-bottom:8px }
.edit-link-card {
  width: 100%;
  background: color-mix(in srgb, var(--brand-light, #d7ebff) 84%, white);
  border: 1px solid var(--editor-border);
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.edit-link-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.edit-link-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.edit-link-input {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--editor-border);
  background: #fff;
  font-family: monospace;
}
.edit-link-error {
  color: #8a2431;
  font-size: 0.92rem;
}
.primary-btn.wide { width:100%; padding:14px 18px; min-height: 46px }
.primary-btn.big { padding:18px 36px; font-size:1.25rem; min-height: 50px }
.primary-btn.small { padding:8px 14px; font-size:0.95rem; min-height: 40px }
.bottom-actions { display:flex; justify-content:space-between; align-items:center; margin-top:28px }
.text-back {
  background: color-mix(in srgb, var(--brand-light, #d7ebff) 45%, white);
  border: 1px solid var(--editor-border);
  border-radius: 10px;
  padding: 12px 16px;
  font-weight:700;
  font-size:1rem;
  color: var(--editor-text);
  min-height: 46px;
}

/* Topbar */
.create-topbar { display:flex; align-items:center; justify-content:space-between; padding:14px 48px; background: linear-gradient(180deg, color-mix(in srgb, var(--brand-light, #d7ebff) 80%, white), #f2f9ff); border-bottom:1px solid color-mix(in srgb, var(--brand-dark, #0c4f82) 10%, white) }
.topbar-right { display:flex; align-items:center; gap:12px }
.icon-btn { background:transparent; border:0; width:44px; height:44px; border-radius:999px; display:grid; place-items:center; cursor:pointer; box-shadow:0 6px 18px #0b3f7420 }
.profile { padding:8px 12px; background:var(--editor-brand); color:#fff; border-radius:10px; font-weight:600 }

/* Two column layout */
.settings-content-v2.two-column { display:grid; grid-template-columns: 1fr 1fr; gap:48px; align-items:start; padding:40px 48px; max-width:1600px; margin:0 auto; box-sizing:border-box }
.left-column { display:flex; flex-direction:column; gap:28px; align-items:flex-start }
.right-column { display:flex; flex-direction:column; gap: 14px }

/* Make columns occupy roughly half the viewport */
.left-column, .right-column { min-width: 0 }
.preview-shell.large { min-height: 380px; width: 100%; max-width: 640px; background: transparent; border: none; padding: 0 }
.create-room-name.big { width: 100%; background: #eef6fb; border: none }
.collaborators-card { width: 100%; background: color-mix(in srgb, var(--brand-light, #d7ebff) 88%, white); border: none; box-shadow: none }
.primary-btn.wide { max-width: 480px; margin-left:0 }

/* Progress bars */
.progress-bars { display:flex; gap:10px; align-items:center; margin-bottom:8px }
.progress-bars .bar { width:120px; height:8px; border-radius:999px; background: #e6eef8; display:block }
.progress-bars .bar.filled { background: linear-gradient(90deg, var(--editor-brand), color-mix(in srgb, var(--editor-brand) 30%, white)) }

/* Adjustments for exact look */
.create-room-v2 { background: linear-gradient(180deg,var(--editor-bg-shell-top, #f6f7f8) 0%,var(--editor-bg-shell-mid, #eff4fa) 58%,var(--editor-bg-shell-bottom, #9fc0e1) 100%); padding:0 }
.settings-header-v2 { display:flex; justify-content:center; padding-top:18px; }
.settings-header-center-v2 { text-align:center }
.settings-step-v2 { font-weight:600; margin-top:6px }

.collaborators-card { background: color-mix(in srgb, var(--brand-light, #d7ebff) 78%, white); padding: 14px; border-radius: 12px; margin-top: 12px; border:1px solid var(--editor-border) }
.collaborator-top { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:8px }
.close-x { background:#ffffff; border:0; border-radius:10px; padding:6px 8px; box-shadow:0 6px 12px #0b3f7420 }
.collaborator-add input { background: white; border-radius:8px; border:1px solid var(--editor-border); padding:12px }

.primary-btn.wide { background: linear-gradient(90deg, var(--editor-brand), color-mix(in srgb, var(--editor-brand) 40%, white)); color:#fff; border:0 }
.primary-btn.big { background: linear-gradient(90deg, var(--editor-brand), color-mix(in srgb, var(--editor-brand) 40%, white)); color:#fff; border:0 }

@media (max-width: 900px) {
  .home-topbar-v2.editor-home-topbar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .settings-page-v2.create-room-v2.editor-home-shell {
    min-height: auto;
  }

  .settings-content-v2.two-column {
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 22px 16px 26px;
  }

  .left-column,
  .right-column {
    gap: 14px;
  }

  .create-room-name.big {
    max-width: none;
    font-size: 1.35rem;
    padding: 14px 14px;
    border-radius: 10px;
    margin-bottom: 8px;
  }

  .preview-shell.large {
    min-height: 280px;
    max-width: none;
  }

  .settings-title {
    font-size: 1.1rem;
    margin-bottom: 2px;
  }

  .setting-row.spaced {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .switch-wrap {
    justify-content: space-between;
  }

  .collaborator-add {
    flex-direction: column;
  }

  .primary-btn.small,
  .primary-btn.wide,
  .primary-btn.big,
  .text-back {
    width: 100%;
  }

  .bottom-actions {
    flex-direction: column-reverse;
    gap: 10px;
    margin-top: 12px;
  }
}

@media (max-width: 640px) {
  .editor-home-user-name {
    display: none;
  }

  .editor-home-brand-logo {
    max-height: 40px;
    max-width: 150px;
  }
}
</style>