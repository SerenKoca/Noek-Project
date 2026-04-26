<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { startGlobalLoading, endGlobalLoading } from '../services/globalLoading.js'
import { ROOM_TEMPLATE } from '../services/roomTemplate.js'

const props = defineProps({
  loadRequest: {
    type: Object,
    default: null
  },
  sceneCommand: {
    type: Object,
    default: null
  },
  roomData: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['selected', 'selected-anchor', 'load-error'])

const containerEl = ref(null)
const cameraCoords = ref('')
const targetCoords = ref('')

let renderer
let scene
let camera
let orbit
let transform
let raycaster
let pointer
let lastCameraYOffset = 0
let initialAzimuth = 0
let currentLookYaw = 0
let isLookDragging = false
let lookDragStartX = 0
let lookDragStartYaw = 0

const selectableRoots = []
let selectedRoot = null

const sceneReady = ref(false)

const loader = new GLTFLoader()

// Keep incoming assets within a predictable furniture-like size range.
const MODEL_SIZE_TARGET = 5.4
const SMALL_DECOR_TARGET_SIZE = 2.2
const TABLE_TARGET_SIZE = 7.0
const MODEL_SCALE_MIN = 0.1
const MODEL_SCALE_MAX = 8
const START_CAMERA = new THREE.Vector3(-83.47, 66.5, 81.55)
const FIXED_TARGET = new THREE.Vector3(14.58, 1.8, -19.46)
const ZOOM_NEAR_DISTANCE = 22
const START_DISTANCE = START_CAMERA.distanceTo(FIXED_TARGET)
const ZOOM_FAR_DISTANCE = START_DISTANCE
const CAMERA_Y_OFFSET_FAR = 0
const CAMERA_Y_OFFSET_NEAR = -30
const AZIMUTH_RANGE_NEAR = Math.PI * 0.28
const AZIMUTH_RANGE_FAR = Math.PI * 0.05
const LOOK_DRAG_SENSITIVITY = 0.004
const ZOOM_RECENTER_STRENGTH = 0.5
const FAR_RESET_BLEND_START = 0.08
const ROOM_SIZE = 34
const WALL_HEIGHT = 19
const DEFAULT_FLOOR_COLOR = '#c0b496'
const DEFAULT_WALL_COLOR = '#8f98a3'
const ROOM_TEMPLATE_STORAGE_KEY = 'noek.room-template.v1'
const FLOOR_Y = 0
const ENFORCE_UNIFORM_MODEL_SIZE = true

const SLOT_SIZE_MULTIPLIERS = {
  'slot-sofa': 1.35,
  'slot-table': 1.15,
  'slot-tv': 1.0,
  'slot-shelf': 1.5
}

const KEYWORD_SIZE_MULTIPLIERS = [
  { test: /computer|desktop|monitor|screen|laptop/i, multiplier: 0.72 },
  { test: /tv|television/i, multiplier: 0.95 },
  { test: /table|desk/i, multiplier: 1.15 },
  { test: /chair|stool/i, multiplier: 1.05 },
  { test: /sofa|couch|bench/i, multiplier: 1.28 },
  { test: /cabinet|bookcase|shelf|wardrobe|closet/i, multiplier: 1.5 }
]

function normalizeTemplateSlots(slots = []) {
  return Array.isArray(slots)
    ? slots
      .map((slot) => ({
        ...slot,
        accepts: Array.isArray(slot?.accepts) && slot.accepts.length ? [...slot.accepts] : ['meubel'],
        categories: Array.isArray(slot?.categories) && slot.categories.length ? [...slot.categories] : getDefaultTemplateCategories(slot?.id),
        position: Array.isArray(slot?.position)
          ? new THREE.Vector3(Number(slot.position[0]) || 0, Number(slot.position[1]) || FLOOR_Y, Number(slot.position[2]) || 0)
          : slot?.position?.isVector3
            ? new THREE.Vector3(Number(slot.position.x) || 0, Number(slot.position.y) || FLOOR_Y, Number(slot.position.z) || 0)
            : new THREE.Vector3(0, 0, 0),
        rotationY: Number(slot?.rotationY) || 0,
        initialModel: slot?.initialModel || null
      }))
      .filter((slot) => String(slot?.id || '').trim())
    : []
}

function cloneTemplateSlots(slots = []) {
  return slots.map((slot) => ({
    ...slot,
    accepts: Array.isArray(slot?.accepts) ? [...slot.accepts] : ['meubel'],
    categories: Array.isArray(slot?.categories) ? [...slot.categories] : getDefaultTemplateCategories(slot?.id),
    position: slot?.position?.isVector3 ? slot.position.clone() : new THREE.Vector3(0, FLOOR_Y, 0),
    initialModel: slot?.initialModel ? { ...slot.initialModel } : null
  }))
}

const BASE_TEMPLATE_SLOTS = normalizeTemplateSlots(ROOM_TEMPLATE?.slots || [])
const TEMPLATE_SLOTS = ref(cloneTemplateSlots(BASE_TEMPLATE_SLOTS))

const slotStates = new Map()
let floorMaterial = null
let wallMaterial = null
const templateEditorOpen = ref(false)
const templateEditorMessage = ref('')
const templateEditorSlotId = ref(TEMPLATE_SLOTS.value[0]?.id || '')
const templateSlotCategory = ref('Alle')
const templateDragEnabled = ref(false)
const templateDragMode = ref('translate')
const templateDraft = ref({
  x: 0,
  y: 0,
  z: 0,
  rotationDeg: 0,
  slotCategories: ['Zetel'],
  acceptsMeubel: true,
  acceptsPersoonlijk: false,
  acceptsDecoratie: false
})
let isSyncingSlotFromTransform = false

const TEMPLATE_SLOT_EDITOR_CATEGORIES = ['Alle', 'Zetel', 'Lamp', 'Tafel', 'Kast', 'Muurdecoratie', 'Decoratie klein', 'Decoratie groot', 'Persoonlijk', 'Media']

function getDefaultTemplateCategories(slotId) {
  const id = String(slotId || '').toLowerCase()
  if (id.includes('sofa') || id.includes('armchair')) return 'Zetel'
  if (id.includes('table')) return 'Tafel'
  if (id.includes('wall') || id.includes('frame') || id.includes('picture') || id.includes('painting')) return 'Muurdecoratie'
  if (id.includes('candle')) return 'Decoratie klein'
  if (id.includes('tv') || id.includes('media')) return 'Media'
  if (id.includes('shelf') || id.includes('kast')) return 'Kast'
  if (id.includes('hat-stand') || id.includes('stand')) return 'Lamp'
  return 'Decoratie groot'
}

function normalizeCategoryList(list = []) {
  return [...new Set(
    (Array.isArray(list) ? list : [list])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .filter((item) => item !== 'Alle')
  )]
}

function getTemplateEditorSlotCategories(slot) {
  const categories = normalizeCategoryList(slot?.categories)
  if (categories.length) return categories
  return normalizeCategoryList(getDefaultTemplateCategories(slot?.id))
}

function matchesTemplateCategoryFilter(slot, filter = templateSlotCategory.value) {
  if (filter === 'Alle') return true
  return getTemplateEditorSlotCategories(slot).includes(filter)
}

const filteredTemplateSlots = computed(() => {
  return TEMPLATE_SLOTS.value.filter((slot) => matchesTemplateCategoryFilter(slot))
})

function getTemplateSlot(slotId = templateEditorSlotId.value) {
  return TEMPLATE_SLOTS.value.find((slot) => slot.id === String(slotId || '')) || null
}

function writeDraftFromSlot(slotId = templateEditorSlotId.value) {
  const slot = getTemplateSlot(slotId)
  if (!slot) return

  const accepts = Array.isArray(slot.accepts) ? slot.accepts : []
  const slotCategories = getTemplateEditorSlotCategories(slot)
  templateDraft.value = {
    x: Number(slot.position?.x || 0).toFixed(2),
    y: Number(slot.position?.y || 0).toFixed(2),
    z: Number(slot.position?.z || 0).toFixed(2),
    rotationDeg: Number((slot.rotationY * 180) / Math.PI).toFixed(1),
    slotCategories,
    acceptsMeubel: accepts.includes('meubel') || accepts.includes('alles'),
    acceptsPersoonlijk: accepts.includes('persoonlijk') || accepts.includes('alles'),
    acceptsDecoratie: accepts.includes('decoratie') || accepts.includes('alles')
  }
}

function applyTemplateSlotToScene(slotId) {
  const slot = getTemplateSlot(slotId)
  const slotState = slotStates.get(slotId)
  if (!slot || !slotState) return

  isSyncingSlotFromTransform = true

  slotState.position.copy(slot.position)
  slotState.rotationY = slot.rotationY
  slotState.label = String(slot?.label || slot.id)
  slotState.accepts = Array.isArray(slot.accepts) ? [...slot.accepts] : ['meubel']
  slotState.categories = getTemplateEditorSlotCategories(slot)

  if (slotState.root) {
    slotState.root.position.set(slot.position.x, slot.position.y, slot.position.z)
    const yOffset = Number(slotState.root.userData?.rotationYOffset || 0)
    slotState.root.rotation.set(0, slot.rotationY + yOffset, 0)
    slotState.root.userData.slotLabel = slotState.label
    slotState.root.userData.slotAccepts = [...slotState.accepts]
    slotState.root.userData.slotCategories = [...slotState.categories]
  }

  if (slotState.marker) {
    slotState.marker.position.set(slot.position.x, slot.position.y, slot.position.z)
    slotState.marker.rotation.set(0, slot.rotationY, 0)
    slotState.marker.userData.slotLabel = slotState.label
    slotState.marker.userData.slotAccepts = [...slotState.accepts]
    slotState.marker.userData.slotCategories = [...slotState.categories]
    slotState.marker.userData.title = `Plaats hier (${slotState.label})`
  }

  if (selectedRoot?.userData?.slotId === slotId) {
    select(selectedRoot)
  }

  isSyncingSlotFromTransform = false
}

function syncSlotFromRoot(root) {
  if (!root || isSyncingSlotFromTransform) return
  const slotId = String(root.userData?.slotId || '')
  if (!slotId) return

  const slot = getTemplateSlot(slotId)
  const slotState = slotStates.get(slotId)
  if (!slot || !slotState) return

  slot.position.set(root.position.x, FLOOR_Y, root.position.z)
  slot.rotationY = root.rotation.y - Number(root.userData?.rotationYOffset || 0)

  applyTemplateSlotToScene(slotId)
  templateEditorSlotId.value = slotId
  writeDraftFromSlot(slotId)
}

function updateTemplateDragBinding() {
  if (!transform) return

  if (!templateDragEnabled.value || !selectedRoot?.userData?.slotId) {
    transform.detach()
    transform.visible = false
    transform.enabled = false
    return
  }

  transform.setMode(templateDragMode.value)
  transform.attach(selectedRoot)
  transform.visible = true
  transform.enabled = true
}

function toggleTemplateDrag() {
  templateDragEnabled.value = !templateDragEnabled.value
  updateTemplateDragBinding()
}

function setTemplateDragMode(mode) {
  if (mode !== 'translate' && mode !== 'rotate') return
  templateDragMode.value = mode
  updateTemplateDragBinding()
}

function applyTemplateDraft() {
  const slot = getTemplateSlot()
  if (!slot) return

  const x = Number(templateDraft.value.x)
  const y = Number(templateDraft.value.y)
  const z = Number(templateDraft.value.z)
  const rotationDeg = Number(templateDraft.value.rotationDeg)

  if (![x, y, z, rotationDeg].every(Number.isFinite)) {
    templateEditorMessage.value = 'Gebruik geldige numerieke waarden voor positie en rotatie.'
    return
  }

  const accepts = []
  if (templateDraft.value.acceptsMeubel) accepts.push('meubel')
  if (templateDraft.value.acceptsPersoonlijk) accepts.push('persoonlijk')
  if (templateDraft.value.acceptsDecoratie) accepts.push('decoratie')
  const slotCategories = normalizeCategoryList(templateDraft.value.slotCategories)

  if (!accepts.length) {
    templateEditorMessage.value = 'Selecteer minstens 1 toegestaan type.'
    return
  }

  if (!slotCategories.length) {
    templateEditorMessage.value = 'Selecteer minstens 1 categorie voor dit slot.'
    return
  }

  const elevatedCategories = new Set(['Muurdecoratie', 'Decoratie klein'])
  const yValue = elevatedCategories.has(slotCategories[0]) || slotCategories.some((category) => elevatedCategories.has(category)) ? y : FLOOR_Y
  slot.position.set(x, yValue, z)
  slot.rotationY = (rotationDeg * Math.PI) / 180
  slot.accepts = accepts
  slot.categories = slotCategories
  applyTemplateSlotToScene(slot.id)
  templateDraft.value.y = yValue
  templateEditorMessage.value = 'Template slot bijgewerkt.'
}

function createNewTemplateSlot() {
  const currentSlot = getTemplateSlot()
  const currentCategories = normalizeCategoryList(templateDraft.value.slotCategories.length ? templateDraft.value.slotCategories : getTemplateEditorSlotCategories(currentSlot))
  const currentAccepts = []
  if (templateDraft.value.acceptsMeubel) currentAccepts.push('meubel')
  if (templateDraft.value.acceptsPersoonlijk) currentAccepts.push('persoonlijk')
  if (templateDraft.value.acceptsDecoratie) currentAccepts.push('decoratie')

  const basePosition = currentSlot?.position?.clone?.() || new THREE.Vector3(0, FLOOR_Y, 0)
  const offset = new THREE.Vector3(1.2, 0, 0.8)
  const slotList = TEMPLATE_SLOTS.value
  let index = 1
  let id = ''

  do {
    id = `slot-custom-${index}`
    index += 1
  } while (slotList.some((slot) => slot.id === id))

  const newSlot = normalizeTemplateSlots([{
    id,
    label: `Nieuw slot ${index - 1}`,
    accepts: currentAccepts.length ? currentAccepts : ['meubel'],
    categories: currentCategories.length ? currentCategories : ['Decoratie groot'],
    position: [basePosition.x + offset.x, currentCategories.some((category) => ['Muurdecoratie', 'Decoratie klein'].includes(category)) ? Math.max(Number(templateDraft.value.y) || 0, 1.1) : FLOOR_Y, basePosition.z + offset.z],
    rotationY: Number(currentSlot?.rotationY || 0),
    initialModel: null
  }])[0]

  TEMPLATE_SLOTS.value = [...slotList, newSlot]

  slotStates.set(newSlot.id, {
    id: newSlot.id,
    label: String(newSlot.label || newSlot.id),
    accepts: Array.isArray(newSlot.accepts) ? [...newSlot.accepts] : ['meubel'],
    categories: getTemplateEditorSlotCategories(newSlot),
    position: newSlot.position.clone(),
    rotationY: newSlot.rotationY,
    preferredRotationYOffset: Number(newSlot?.initialModel?.rotationYOffset) || 0,
    root: null,
    marker: null
  })

  const marker = createSlotMarker(newSlot.id)
  marker.position.set(newSlot.position.x, newSlot.position.y, newSlot.position.z)
  marker.rotation.set(0, newSlot.rotationY, 0)
  scene.add(marker)
  selectableRoots.push(marker)
  const slotState = slotStates.get(newSlot.id)
  if (slotState) slotState.marker = marker

  templateEditorSlotId.value = newSlot.id
  templateSlotCategory.value = currentCategories[0] || 'Alle'
  writeDraftFromSlot(newSlot.id)
  select(marker)
  templateEditorMessage.value = 'Nieuw slot toegevoegd.'
}

function getTemplateSnapshot() {
  return TEMPLATE_SLOTS.value
    .map((slot) => ({
    id: slot.id,
    label: slot.label,
    accepts: Array.isArray(slot.accepts) ? [...slot.accepts] : ['meubel'],
    categories: getTemplateEditorSlotCategories(slot),
    position: [slot.position.x, slot.position.y, slot.position.z],
    rotationY: slot.rotationY,
    initialModel: slot.initialModel ? { ...slot.initialModel } : null
  }))
}

function saveTemplateToLocalStorage() {
  try {
    localStorage.setItem(ROOM_TEMPLATE_STORAGE_KEY, JSON.stringify(getTemplateSnapshot()))
    templateEditorMessage.value = 'Template lokaal opgeslagen.'
  } catch {
    templateEditorMessage.value = 'Opslaan mislukt (localStorage niet beschikbaar).'
  }
}

function restoreTemplateFromBase() {
  TEMPLATE_SLOTS.value = cloneTemplateSlots(BASE_TEMPLATE_SLOTS)
}

function resetTemplateDefaults() {
  try {
    localStorage.removeItem(ROOM_TEMPLATE_STORAGE_KEY)
  } catch {
    // ignore
  }

  restoreTemplateFromBase()
  rebuildTemplateSlotScene({ hydrateCurated: true })
  writeDraftFromSlot()
  templateEditorMessage.value = 'Template hersteld naar standaard.'
}

function applyStoredTemplateIfAny() {
  let parsed = null
  try {
    const raw = localStorage.getItem(ROOM_TEMPLATE_STORAGE_KEY)
    parsed = raw ? JSON.parse(raw) : null
  } catch {
    parsed = null
  }

  if (!Array.isArray(parsed) || parsed.length === 0) return

  TEMPLATE_SLOTS.value = normalizeTemplateSlots(parsed)
}

function toColorHex(value, fallback) {
  const input = String(value || '').trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(input)) return input
  return fallback
}

function applyRoomColors({ floorColor, wallColor } = {}) {
  const nextFloor = toColorHex(floorColor, DEFAULT_FLOOR_COLOR)
  const nextWall = toColorHex(wallColor, DEFAULT_WALL_COLOR)

  if (floorMaterial?.color) {
    floorMaterial.color.set(nextFloor)
    floorMaterial.needsUpdate = true
  }

  if (wallMaterial?.color) {
    wallMaterial.color.set(nextWall)
    wallMaterial.needsUpdate = true
  }

  return { floorColor: nextFloor, wallColor: nextWall }
}


function createScene() {
  scene = new THREE.Scene()
  scene.background = null

  camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400)
  camera.up.set(0, 1, 0)
  camera.position.copy(START_CAMERA)
  camera.lookAt(FIXED_TARGET)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.cursor = 'pointer'

  const el = containerEl.value
  el.appendChild(renderer.domElement)

  orbit = new OrbitControls(camera, renderer.domElement)
  orbit.enableDamping = true
  orbit.enablePan = false
  orbit.enableRotate = false
  orbit.enableZoom = true
  orbit.dampingFactor = 0.08
  orbit.zoomSpeed = 2.2
  orbit.minDistance = ZOOM_NEAR_DISTANCE
  orbit.maxDistance = ZOOM_FAR_DISTANCE
  orbit.zoomToCursor = false
  orbit.mouseButtons = {
    LEFT: THREE.MOUSE.NONE,
    MIDDLE: THREE.MOUSE.NONE,
    RIGHT: THREE.MOUSE.NONE
  }
  orbit.screenSpacePanning = false
  orbit.target.copy(FIXED_TARGET)
  orbit.update()
  const dirX = FIXED_TARGET.x - START_CAMERA.x
  const dirZ = FIXED_TARGET.z - START_CAMERA.z
  initialAzimuth = Math.atan2(dirX, dirZ)
  currentLookYaw = initialAzimuth
  syncTargetToCurrentYaw()
  updateCameraDebug()

  transform = new TransformControls(camera, renderer.domElement)
  transform.setMode('translate')
  transform.enabled = false
  transform.visible = false
  transform.setSpace('world')
  transform.showY = false
  transform.translationSnap = 0.25
  transform.rotationSnap = Math.PI / 24
  transform.addEventListener('dragging-changed', (e) => {
    orbit.enabled = !e.value
  })
  transform.addEventListener('objectChange', () => {
    if (!selectedRoot) return
    syncSlotFromRoot(selectedRoot)
  })
  scene.add(transform)

  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()

  // Lights (required)
  const hemi = new THREE.HemisphereLight(0xffffff, 0xb2c8dd, 1.05)
  hemi.position.set(0, 10, 0)
  scene.add(hemi)

  const dir = new THREE.DirectionalLight(0xffffff, 1.15)
  dir.position.set(5, 10, 3)
  dir.castShadow = false
  scene.add(dir)

  // Large room surfaces to keep borders out of view while zooming.
  const floorGeo = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE)
  floorMaterial = new THREE.MeshStandardMaterial({
    color: DEFAULT_FLOOR_COLOR,
    roughness: 0.95,
    metalness: 0.0
  })
  const floor = new THREE.Mesh(floorGeo, floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, -0.001, 0)
  floor.receiveShadow = false
  scene.add(floor)

  // Back wall
  wallMaterial = new THREE.MeshStandardMaterial({
    color: DEFAULT_WALL_COLOR,
    roughness: 0.92,
    metalness: 0.0,
    side: THREE.DoubleSide
  })

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, WALL_HEIGHT), wallMaterial)
  backWall.position.set(0, WALL_HEIGHT / 2, -ROOM_SIZE / 2)
  scene.add(backWall)

  // Right wall
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, WALL_HEIGHT), wallMaterial)
  rightWall.rotation.y = -Math.PI / 2
  rightWall.position.set(ROOM_SIZE / 2, WALL_HEIGHT / 2, 0)
  scene.add(rightWall)

  initializeFurnitureSlots()
  hydrateCuratedDefaultFurniture()
  deselect()

  // Event handlers
  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('pointermove', onPointerMove)
  renderer.domElement.addEventListener('pointerup', onPointerUp)
  renderer.domElement.addEventListener('pointercancel', onPointerUp)

  resize()
  window.addEventListener('resize', resize)

  animate()
}

function resize() {
  if (!containerEl.value || !renderer || !camera) return

  const { clientWidth: w, clientHeight: h } = containerEl.value
  if (!w || !h) return

  camera.aspect = w / h
  camera.updateProjectionMatrix()

  renderer.setSize(w, h, false)
}

function animate() {
  if (!renderer) return
  renderer.setAnimationLoop(() => {
    // Restore the previous frame's synthetic Y offset before OrbitControls updates.
    if (lastCameraYOffset !== 0) {
      camera.position.y -= lastCameraYOffset
      lastCameraYOffset = 0
    }

    syncTargetToCurrentYaw()
    orbit?.update()
    updateCameraVerticalDrift()
    syncTargetToCurrentYaw()

    // Safety fallback: keep camera/target finite so the scene never disappears.
    if (!Number.isFinite(camera.position.x) || !Number.isFinite(camera.position.y) || !Number.isFinite(camera.position.z)) {
      camera.position.copy(START_CAMERA)
    }
    if (!Number.isFinite(orbit.target.x) || !Number.isFinite(orbit.target.y) || !Number.isFinite(orbit.target.z)) {
      orbit.target.copy(FIXED_TARGET)
    }

    updateCameraDebug()
    updateSelectedAnchor()
    renderer.render(scene, camera)
  })
}

function syncTargetToCurrentYaw() {
  if (!camera || !orbit) return

  const distance = typeof orbit.getDistance === 'function'
    ? orbit.getDistance()
    : camera.position.distanceTo(orbit.target)

  if (!Number.isFinite(distance) || distance <= 0) {
    orbit.target.copy(FIXED_TARGET)
    camera.lookAt(orbit.target)
    return
  }

  // Use horizontal distance for XZ target placement to avoid runaway target drift.
  const deltaY = camera.position.y - FIXED_TARGET.y
  const planarSq = (distance * distance) - (deltaY * deltaY)
  const planarDistance = Number.isFinite(planarSq) ? Math.sqrt(Math.max(planarSq, 0.001)) : 0.001
  const dx = Math.sin(currentLookYaw)
  const dz = Math.cos(currentLookYaw)

  orbit.target.set(
    camera.position.x + dx * planarDistance,
    FIXED_TARGET.y,
    camera.position.z + dz * planarDistance
  )
  camera.lookAt(orbit.target)
}

function getCurrentYawRange() {
  if (!orbit || !camera) return AZIMUTH_RANGE_NEAR

  const distance = typeof orbit.getDistance === 'function'
    ? orbit.getDistance()
    : camera.position.distanceTo(orbit.target)

  const span = Math.max(ZOOM_FAR_DISTANCE - ZOOM_NEAR_DISTANCE, 0.001)
  const t = THREE.MathUtils.clamp((ZOOM_FAR_DISTANCE - distance) / span, 0, 1)
  return THREE.MathUtils.lerp(AZIMUTH_RANGE_FAR, AZIMUTH_RANGE_NEAR, t)
}

function updateCameraVerticalDrift() {
  if (!orbit || !camera) return

  const distance = typeof orbit.getDistance === 'function'
    ? orbit.getDistance()
    : camera.position.distanceTo(orbit.target)

  const t = THREE.MathUtils.clamp(
    (ZOOM_FAR_DISTANCE - distance) / (ZOOM_FAR_DISTANCE - ZOOM_NEAR_DISTANCE),
    0,
    1
  )

  // While zooming in, gently pull look direction back to center so dolly-in stays centered.
  if (!isLookDragging && t > 0.001) {
    const yawRange = getCurrentYawRange()
    const recentered = THREE.MathUtils.lerp(currentLookYaw, initialAzimuth, t * ZOOM_RECENTER_STRENGTH)
    currentLookYaw = THREE.MathUtils.clamp(
      recentered,
      initialAzimuth - yawRange,
      initialAzimuth + yawRange
    )
  }

  // Blend back to the exact start framing near max zoom-out to remove cumulative drift.
  if (!isLookDragging && t < FAR_RESET_BLEND_START) {
    const resetT = THREE.MathUtils.clamp(1 - (t / FAR_RESET_BLEND_START), 0, 1)
    currentLookYaw = THREE.MathUtils.lerp(currentLookYaw, initialAzimuth, resetT)
    orbit.target.lerp(FIXED_TARGET, resetT)
    camera.position.lerp(START_CAMERA, resetT)
  }

  // Keep stable when fully zoomed out without snapping position.
  if (t <= 0.001) {
    currentLookYaw = initialAzimuth
    orbit.target.copy(FIXED_TARGET)
    camera.position.copy(START_CAMERA)
    camera.lookAt(orbit.target)
    lastCameraYOffset = 0
    return
  }

  // Ease-in curve makes the camera pitch change happen earlier while zooming in.
  const tFast = Math.pow(t, 0.7)
  const nextYOffset = THREE.MathUtils.lerp(CAMERA_Y_OFFSET_FAR, CAMERA_Y_OFFSET_NEAR, tFast)
  camera.position.y += nextYOffset
  camera.lookAt(orbit.target)
  lastCameraYOffset = nextYOffset
}

function updateCameraDebug() {
  if (!camera || !orbit) return
  const p = camera.position
  const t = orbit.target
  cameraCoords.value = `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`
  targetCoords.value = `${t.x.toFixed(2)}, ${t.y.toFixed(2)}, ${t.z.toFixed(2)}`
}

function updateSelectedAnchor() {
  if (!selectedRoot || !camera || !renderer) {
    emit('selected-anchor', null)
    return
  }

  const box = new THREE.Box3().setFromObject(selectedRoot)
  if (!isFinite(box.min.x) || !isFinite(box.max.x)) {
    emit('selected-anchor', null)
    return
  }

  const center = new THREE.Vector3()
  box.getCenter(center)

  // Lift action bubble slightly above object center.
  center.y = box.max.y + 0.2

  const projected = center.project(camera)
  if (projected.z > 1 || projected.z < -1) {
    emit('selected-anchor', null)
    return
  }

  const width = renderer.domElement.clientWidth
  const height = renderer.domElement.clientHeight
  const x = ((projected.x + 1) / 2) * width
  const y = ((-projected.y + 1) / 2) * height

  emit('selected-anchor', { x, y })
}

function initializeFurnitureSlots() {
  for (const slot of TEMPLATE_SLOTS.value) {
    slotStates.set(slot.id, {
      id: slot.id,
      label: String(slot?.label || slot.id),
      accepts: Array.isArray(slot?.accepts) ? [...slot.accepts] : ['meubel'],
      categories: getTemplateEditorSlotCategories(slot),
      position: slot.position.clone(),
      rotationY: slot.rotationY,
      preferredRotationYOffset: Number(slot?.initialModel?.rotationYOffset) || 0,
      root: null,
      marker: null
    })

    const defaultRoot = createDefaultFurnitureForSlot(slot)
    assignRootToSlot(defaultRoot, slot.id)
  }
}

async function hydrateCuratedDefaultFurniture() {
  for (const slot of TEMPLATE_SLOTS.value) {
    const curated = slot.initialModel
    if (!curated?.url) continue

    try {
      await loadModelAsset({
        url: curated.url,
        title: curated.title || slot.label || slot.id,
        id: curated.id || slot.id,
        replaceRoot: { slotId: slot.id },
        transform: {
          sizeMultiplier: Number(curated.scaleMultiplier) || 1,
          rotationYOffset: curated.rotationYOffset,
          yOffset: curated.yOffset
        }
      })
    } catch (error) {
      // Keep placeholder furniture when remote model loading fails.
      console.warn(`Curated default model failed for ${slot.id}:`, error?.message || error)
    }
  }
}

function createDefaultFurnitureForSlot(slot) {
  const root = new THREE.Group()
  root.userData.isRootModel = true
  root.userData.isSlotMarker = false
  root.userData.slotId = slot.id
  root.userData.slotLabel = String(slot?.label || slot.id)
  root.userData.slotAccepts = Array.isArray(slot?.accepts) ? [...slot.accepts] : ['meubel']
  root.userData.id = slot.id
  root.userData.title = String(slot?.label || slot.id.replace('slot-', '').replace('-', ' '))

  const material = new THREE.MeshStandardMaterial({ color: 0xc6b89b, roughness: 0.95, metalness: 0 })

  if (slot.id === 'slot-sofa') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.0, 1.7), material)
    base.position.set(0, 0.5, 0)
    root.add(base)
  } else if (slot.id === 'slot-table') {
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.15, 1.2), material)
    top.position.set(0, 1.0, 0)
    root.add(top)
    const legMat = new THREE.MeshStandardMaterial({ color: 0x9a8d73, roughness: 0.95, metalness: 0 })
    const legPositions = [[0.9, 0.5, 0.5], [-0.9, 0.5, 0.5], [0.9, 0.5, -0.5], [-0.9, 0.5, -0.5]]
    for (const [x, y, z] of legPositions) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 0.12), legMat)
      leg.position.set(x, y, z)
      root.add(leg)
    }
  } else if (slot.id === 'slot-tv') {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 0.6), material)
    stand.position.set(0, 0.18, 0)
    root.add(stand)
  } else {
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.8), material)
    cabinet.position.set(0, 1.3, 0)
    root.add(cabinet)
  }

  // Keep starter furniture aligned with imported-model normalization.
  const effectiveTargetSize = getEffectiveTargetSize({
    slotId: slot?.id,
    title: root.userData.title,
    baseTargetSize: MODEL_SIZE_TARGET
  })
  centerAndGround(root, effectiveTargetSize)

  return root
}

function createSlotMarker(slotId) {
  const slot = getTemplateSlot(slotId)
  const slotState = slotStates.get(slotId)
  const preferredRotationYOffset = Number(slotState?.preferredRotationYOffset || 0)
  const root = new THREE.Group()
  root.userData.isRootModel = true
  root.userData.isSlotMarker = true
  root.userData.slotId = slotId
  root.userData.slotLabel = String(slot?.label || slotId)
  root.userData.slotAccepts = Array.isArray(slot?.accepts) ? [...slot.accepts] : ['meubel']
  root.userData.slotCategories = getTemplateEditorSlotCategories(slot)
  root.userData.rotationYOffset = preferredRotationYOffset
  root.userData.id = `marker-${slotId}`
  root.userData.title = `Plaats hier (${root.userData.slotLabel})`

  const markerMat = new THREE.MeshStandardMaterial({ color: 0x2b7dd8, roughness: 0.75, metalness: 0.1 })
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.12), markerMat)
  h.position.set(0, 0.3, 0)
  root.add(h)

  const v = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), markerMat)
  v.position.set(0, 0.3, 0)
  root.add(v)

  return root
}

function rebuildTemplateSlotScene({ hydrateCurated = true } = {}) {
  if (!scene) return

  for (const slot of slotStates.values()) {
    if (slot?.root) removeRoot(slot.root)
    if (slot?.marker) removeRoot(slot.marker)
  }

  slotStates.clear()
  initializeFurnitureSlots()

  if (hydrateCurated) {
    hydrateCuratedDefaultFurniture()
  }

  const nextSlotId = getTemplateSlot(templateEditorSlotId.value)?.id || TEMPLATE_SLOTS.value[0]?.id || ''
  if (nextSlotId) {
    templateEditorSlotId.value = nextSlotId
  }
}

function assignRootToSlot(root, slotId) {
  const slot = slotStates.get(slotId)
  if (!slot || !root) return

  if (slot.root) {
    removeRoot(slot.root)
  }
  if (slot.marker) {
    removeRoot(slot.marker)
    slot.marker = null
  }

  root.userData.slotId = slotId
  root.userData.slotLabel = String(slot?.label || slotId)
  root.userData.slotAccepts = Array.isArray(slot?.accepts) ? [...slot.accepts] : ['meubel']
  root.userData.slotCategories = Array.isArray(slot?.categories) ? [...slot.categories] : []
  const rootYOffset = Number(root.userData?.rotationYOffset)
  const effectiveYOffset = Number.isFinite(rootYOffset)
    ? rootYOffset
    : Number(slot.preferredRotationYOffset || 0)
  root.userData.rotationYOffset = effectiveYOffset
  slot.preferredRotationYOffset = effectiveYOffset
  root.userData.isSlotMarker = false
  root.position.set(slot.position.x, slot.position.y, slot.position.z)
  root.rotation.set(0, slot.rotationY + Number(root.userData.rotationYOffset || 0), 0)
  snapRootToFloor(root, FLOOR_Y)
  root.updateMatrixWorld(true)
  snapRootToFloor(root, FLOOR_Y)

  scene.add(root)
  selectableRoots.push(root)
  slot.root = root
  select(root)
}

function removeFurnitureFromSlot(slotId) {
  const slot = slotStates.get(slotId)
  if (!slot || !slot.root) return

  const previousYOffset = Number(slot.root.userData?.rotationYOffset)
  if (Number.isFinite(previousYOffset)) {
    slot.preferredRotationYOffset = previousYOffset
  }

  removeRoot(slot.root)
  slot.root = null

  const marker = createSlotMarker(slotId)
  marker.position.set(slot.position.x, slot.position.y, slot.position.z)
  marker.rotation.set(0, slot.rotationY, 0)
  scene.add(marker)
  selectableRoots.push(marker)
  slot.marker = marker
  select(marker)
}

function getRootModel(obj) {
  let cur = obj
  while (cur) {
    if (cur.userData && cur.userData.isRootModel) return cur
    cur = cur.parent
  }
  return null
}

function deselect() {
  selectedRoot = null
  if (transform) {
    transform.detach()
    transform.visible = false
    transform.enabled = false
  }
  emit('selected', null)
  emit('selected-anchor', null)
}

function select(root) {
  selectedRoot = root
  if (root?.userData?.slotId) {
    templateEditorSlotId.value = String(root.userData.slotId)
    writeDraftFromSlot(templateEditorSlotId.value)
  }
  const info = {
    uuid: root?.uuid || '',
    id: root?.userData?.id || '',
    title: root?.userData?.title || '',
    slotId: root?.userData?.slotId || '',
    slotLabel: root?.userData?.slotLabel || '',
    slotAccepts: Array.isArray(root?.userData?.slotAccepts) ? [...root.userData.slotAccepts] : [],
    slotCategories: Array.isArray(root?.userData?.slotCategories) ? [...root.userData.slotCategories] : [],
    isSlotMarker: !!root?.userData?.isSlotMarker
  }
  updateTemplateDragBinding()
  emit('selected', info)
  updateSelectedAnchor()
}

function removeRoot(root) {
  if (!root) return

  const idx = selectableRoots.indexOf(root)
  if (idx >= 0) selectableRoots.splice(idx, 1)

  if (selectedRoot === root) {
    deselect()
  }

  scene.remove(root)
}

function getRootByUuid(uuid) {
  if (!uuid) return null
  return selectableRoots.find((root) => root.uuid === uuid) || null
}

function serializeRoom() {
  const furniture = []

  for (const [slotId, slot] of slotStates.entries()) {
    if (slot?.marker) {
      furniture.push({
        slotId,
        isEmpty: true
      })
      continue
    }

    const root = slot?.root
    if (!root || root.userData?.isSlotMarker) continue

    furniture.push({
      slotId,
      title: root.userData?.title || '',
      url: root.userData?.url || null,
      position: root.position.toArray(),
      rotationY: root.rotation.y,
      scale: root.scale.toArray(),
      sizeMultiplier: Number(root.userData?.sizeMultiplier || 1),
      isEmpty: false
    })
  }

  const result = {
    metadata: {
      savedAt: new Date().toISOString(),
      roomSize: ROOM_SIZE,
      wallHeight: WALL_HEIGHT
    },
    templateSlots: getTemplateSnapshot(),
    furniture,
    appearance: applyRoomColors({
      floorColor: floorMaterial?.color?.getHexString ? `#${floorMaterial.color.getHexString()}` : DEFAULT_FLOOR_COLOR,
      wallColor: wallMaterial?.color?.getHexString ? `#${wallMaterial.color.getHexString()}` : DEFAULT_WALL_COLOR
    }),
    camera: {
      position: camera?.position?.toArray?.() || null,
      target: orbit?.target?.toArray?.() || null
    }
  }

  return result
}

async function loadRoom(sceneData) {
  TEMPLATE_SLOTS.value = Array.isArray(sceneData?.templateSlots) && sceneData.templateSlots.length
    ? normalizeTemplateSlots(sceneData.templateSlots)
    : cloneTemplateSlots(BASE_TEMPLATE_SLOTS)

  if (!sceneData || !Array.isArray(sceneData.furniture)) {
    // Reset to default state for new rooms
    resetSceneToDefault({ hydrateCurated: true })
    applyRoomColors()
    return
  }

  // Reset scene to default state first
  resetSceneToDefault({ hydrateCurated: false })
  applyRoomColors(sceneData.appearance || {})

  // Load saved furniture
  for (const item of sceneData.furniture) {
    const slotId = item.slotId
    const slot = slotStates.get(slotId)
    if (!slot) {
      continue
    }

    if (item.isEmpty) {
      removeFurnitureFromSlot(slotId)
      continue
    }

    if (item.url) {
      // Load custom model
      try {
        // Fix URL if it's relative
        let fixedUrl = item.url
        if (fixedUrl.startsWith('/poly-static/')) {
          fixedUrl = 'http://localhost:5000/api' + fixedUrl
        }

        await loadModelAsset({
          url: fixedUrl,
          title: item.title || 'Loaded model',
          id: item.id || `loaded-${Date.now()}`,
          replaceRoot: { slotId },
          transform: {
            sizeMultiplier: Number(item.sizeMultiplier) || 1
          }
        })
      } catch (error) {
        console.error('Failed to load saved model:', error)
        // Fallback to default furniture
        const defaultRoot = createDefaultFurnitureForSlot(slot)
        assignRootToSlot(defaultRoot, slotId)
      }
    } else {
      // Use default furniture but apply saved transformations
      const defaultRoot = createDefaultFurnitureForSlot(slot)
      if (Array.isArray(item.position) && item.position.length >= 3) {
        defaultRoot.position.set(Number(item.position[0]) || 0, FLOOR_Y, Number(item.position[2]) || 0)
      }
      if (item.rotationY !== undefined) defaultRoot.rotation.y = item.rotationY
      snapRootToFloor(defaultRoot, FLOOR_Y)
      assignRootToSlot(defaultRoot, slotId)
    }
  }

  // Always start from the same entry camera when opening a room.
  if (camera) {
    camera.position.copy(START_CAMERA)
  }
  if (orbit) {
    orbit.target.copy(FIXED_TARGET)
    orbit.update()
  }
  currentLookYaw = initialAzimuth
  syncTargetToCurrentYaw()

  deselect()
}

function resetSceneToDefault({ hydrateCurated = true } = {}) {
  // Remove all current objects
  for (const slot of TEMPLATE_SLOTS.value) {
    const slotState = slotStates.get(slot.id)
    if (slotState?.root) {
      removeRoot(slotState.root)
      slotState.root = null
    }
    if (slotState?.marker) {
      removeRoot(slotState.marker)
      slotState.marker = null
    }
  }

  // Reset camera to default position
  if (camera) {
    camera.position.copy(START_CAMERA)
  }
  if (orbit) {
    orbit.target.copy(FIXED_TARGET)
  }

  // Reinitialize default furniture
  initializeFurnitureSlots()
  if (hydrateCurated) {
    hydrateCuratedDefaultFurniture()
  }
  applyRoomColors()
}

defineExpose({ serializeRoom, loadRoom })

function onPointerDown(e) {
  // Avoid changing selection while dragging the transform gizmo.
  if (transform?.dragging) return

  if (e.button === 0) {
    isLookDragging = true
    lookDragStartX = e.clientX
    lookDragStartYaw = currentLookYaw
    renderer.domElement.style.cursor = 'grabbing'
  }

  const rect = renderer.domElement.getBoundingClientRect()
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)

  raycaster.setFromCamera(pointer, camera)

  // Raycast full scene and pick the first hit that belongs to a model root.
  const hits = raycaster.intersectObjects(scene.children, true)
  const firstModelHit = hits.find((hit) => getRootModel(hit.object))
  if (!firstModelHit) {
    deselect()
    return
  }

  const root = getRootModel(firstModelHit.object)
  if (!root) {
    deselect()
    return
  }

  select(root)
}

function onPointerMove(e) {
  if (!isLookDragging) return

  const deltaX = e.clientX - lookDragStartX
  const nextYaw = lookDragStartYaw - (deltaX * LOOK_DRAG_SENSITIVITY)
  const yawRange = getCurrentYawRange()
  currentLookYaw = THREE.MathUtils.clamp(
    nextYaw,
    initialAzimuth - yawRange,
    initialAzimuth + yawRange
  )
  syncTargetToCurrentYaw()
}

function onPointerUp() {
  isLookDragging = false
  if (renderer?.domElement) {
    renderer.domElement.style.cursor = 'pointer'
  }
}

function getEffectiveTargetSize({ slotId = '', title = '', modelCategory = '', baseTargetSize = MODEL_SIZE_TARGET } = {}) {
  if (isSmallDecorationSlot(slotId)) {
    return SMALL_DECOR_TARGET_SIZE
  }

  if (isTableModel({ title, modelCategory })) {
    return TABLE_TARGET_SIZE
  }

  const slotMultiplier = SLOT_SIZE_MULTIPLIERS[String(slotId || '').toLowerCase()] || 1
  const normalizedTitle = String(title || '')
  const keywordRule = KEYWORD_SIZE_MULTIPLIERS.find((rule) => rule.test.test(normalizedTitle))
  const keywordMultiplier = keywordRule?.multiplier || 1

  return baseTargetSize * slotMultiplier * keywordMultiplier
}

function isSmallDecorationSlot(slotId = '') {
  const normalizedSlotId = String(slotId || '').trim()
  if (!normalizedSlotId) return false

  const templateSlot = TEMPLATE_SLOTS.value.find((slot) => slot.id === normalizedSlotId)
  const categories = normalizeCategoryList(templateSlot?.categories || getDefaultTemplateCategories(normalizedSlotId))

  return categories.includes('Decoratie klein')
}

function isTableModel({ title = '', modelCategory = '' } = {}) {
  const normalizedCategory = String(modelCategory || '').trim().toLowerCase()
  if (normalizedCategory === 'tafel') return true

  const normalizedTitle = String(title || '').toLowerCase()
  return /table|desk/.test(normalizedTitle)
}

function getMeshBoundingBox(object3D) {
  if (!object3D) return null

  object3D.updateMatrixWorld(true)

  const union = new THREE.Box3()
  const temp = new THREE.Box3()
  let hasBounds = false

  object3D.traverse((node) => {
    if (!node?.isMesh || !node.geometry) return
    if (!node.geometry.boundingBox) {
      node.geometry.computeBoundingBox()
    }
    if (!node.geometry.boundingBox) return

    temp.copy(node.geometry.boundingBox)
    temp.applyMatrix4(node.matrixWorld)

    if (!Number.isFinite(temp.min.x) || !Number.isFinite(temp.max.x)) return
    if (!hasBounds) {
      union.copy(temp)
      hasBounds = true
    } else {
      union.union(temp)
    }
  })

  return hasBounds ? union : null
}

function centerAndGround(object3D, targetSize = MODEL_SIZE_TARGET) {
  const box = getMeshBoundingBox(object3D)
  if (!box) return

  const size = new THREE.Vector3()
  box.getSize(size)

  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim > 0) {
    const targetScale = THREE.MathUtils.clamp(targetSize / maxDim, MODEL_SCALE_MIN, MODEL_SCALE_MAX)
    object3D.scale.multiplyScalar(targetScale)
  }

  // Recompute box after scaling
  const box2 = getMeshBoundingBox(object3D)
  if (!box2) return
  const center = new THREE.Vector3()
  box2.getCenter(center)

  object3D.position.x -= center.x
  object3D.position.z -= center.z

  // Sit on the floor: move so minY == 0
  const box3 = getMeshBoundingBox(object3D)
  if (!box3) return
  const minY = box3.min.y
  if (isFinite(minY)) {
    object3D.position.y -= minY
  }
}

function snapRootToFloor(root, floorY = FLOOR_Y) {
  if (!root) return

  root.updateMatrixWorld(true)
  const box = getMeshBoundingBox(root)
  if (!box) return

  const delta = floorY - box.min.y
  if (Number.isFinite(delta) && delta > 0) {
    root.position.y += delta
    root.updateMatrixWorld(true)
  }
}

async function loadModelAsset({ url, title, id, replaceRoot = null, transform = {} }) {
  if (!url) {
    throw new Error('Missing model URL')
  }

  const loadingToken = startGlobalLoading()

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        try {
          const rawScene = gltf.scene || gltf.scenes?.[0]
          if (!rawScene) {
            reject(new Error('GLTF has no scene'))
            return
          }

          const targetSlotId = replaceRoot?.userData?.slotId || replaceRoot?.slotId || ''
          if (!targetSlotId || !slotStates.has(targetSlotId)) {
            reject(new Error('Selecteer eerst een meubel of pluspositie in de kamer.'))
            return
          }

          const holder = new THREE.Group()
          holder.userData.isRootModel = true
          holder.userData.id = id || ''
          holder.userData.title = title || ''
          holder.userData.url = url
          holder.add(rawScene)

          // Basic material safety: ensure meshes are visible.
          holder.traverse((c) => {
            if (c.isMesh) {
              c.castShadow = false
              c.receiveShadow = false
              c.frustumCulled = true
            }
          })

          rawScene.position.set(0, 0, 0)
          const effectiveTargetSize = getEffectiveTargetSize({
            slotId: targetSlotId,
            title,
            modelCategory: transform?.modelCategory,
            baseTargetSize: Number(transform?.targetSize) || MODEL_SIZE_TARGET
          })
          const sizeMultiplier = Number(transform?.sizeMultiplier)
          const shouldUseUniformSize = isSmallDecorationSlot(targetSlotId)
            || isTableModel({ title, modelCategory: transform?.modelCategory })
          const normalizedSize = shouldUseUniformSize
            ? effectiveTargetSize
            : Number.isFinite(sizeMultiplier) && sizeMultiplier > 0
              ? effectiveTargetSize * sizeMultiplier
              : effectiveTargetSize
          centerAndGround(holder, normalizedSize)
          holder.userData.sizeMultiplier = shouldUseUniformSize
            ? 1
            : Number.isFinite(sizeMultiplier) && sizeMultiplier > 0
              ? sizeMultiplier
              : 1

          const explicitRotationYOffset = Number(transform?.rotationYOffset)
          const inheritedRotationYOffset = Number(replaceRoot?.userData?.rotationYOffset)
          if (Number.isFinite(explicitRotationYOffset)) {
            holder.userData.rotationYOffset = explicitRotationYOffset
          } else if (Number.isFinite(inheritedRotationYOffset)) {
            holder.userData.rotationYOffset = inheritedRotationYOffset
          }

          if (!ENFORCE_UNIFORM_MODEL_SIZE && Number.isFinite(transform?.scaleMultiplier) && transform.scaleMultiplier > 0) {
            holder.scale.multiplyScalar(transform.scaleMultiplier)
          }

          if (!ENFORCE_UNIFORM_MODEL_SIZE && Number.isFinite(transform?.yOffset)) {
            holder.position.y += transform.yOffset
          }

          assignRootToSlot(holder, targetSlotId)
          snapRootToFloor(holder, FLOOR_Y)

          resolve(holder)
        } catch (e) {
          reject(e)
        }
      },
      undefined,
      (err) => reject(err)
    )
  }).finally(() => {
    endGlobalLoading(loadingToken)
  })
}

watch(
  () => props.loadRequest,
  async (req) => {
    if (!req) return

    const assetUrl = req.url || req.downloadUrl || req.Download
    const title = req.title || req.name || req.Title || 'Untitled model'
    const id = req.id || req.ID || ''
    const placementMode = req.placementMode || 'replace-selected'
    const targetUuid = req.targetUuid || ''
    const targetSlotId = req.targetSlotId || ''

    if (!assetUrl) {
      const message = `Failed to load model: ${title}, Error: Missing model URL.`
      console.error(message, { id, request: req })
      emit('load-error', message)
      return
    }

    try {
      let replaceRoot = null
      if (placementMode === 'replace-selected') {
        replaceRoot = getRootByUuid(targetUuid) || selectedRoot
      }

      if (!replaceRoot && targetSlotId && slotStates.has(targetSlotId)) {
        const slot = slotStates.get(targetSlotId)
        replaceRoot = slot?.root || slot?.marker || null
      }

      await loadModelAsset({
        url: assetUrl,
        title,
        id,
        replaceRoot,
        transform: {
          sizeMultiplier: Number(req.sizeMultiplier) || 1,
          modelCategory: req.modelCategory || ''
        }
      })
    } catch (error) {
      const detail = error?.message || 'Unknown error'
      const message = `Failed to load model: ${title}, Error: ${detail}`
      console.error(message, { id, url: assetUrl, error })
      emit('load-error', message)
    }
  }
)

watch(
  [() => props.roomData, sceneReady],
  async ([newRoomData, ready]) => {
    if (!ready || !newRoomData) return
    const roomHydrationToken = startGlobalLoading()
    // Wait for next tick to ensure scene is ready
    try {
      await nextTick()
      await loadRoom(newRoomData)
    } finally {
      endGlobalLoading(roomHydrationToken)
    }
  },
  { immediate: true }
)

watch(
  () => props.sceneCommand,
  (command) => {
    if (!command || !command.type) return
    if (command.type === 'delete-selected' && selectedRoot && !selectedRoot.userData?.isSlotMarker) {
      const slotId = selectedRoot.userData?.slotId || ''
      if (slotId) removeFurnitureFromSlot(slotId)
      return
    }

    if (command.type === 'apply-room-colors') {
      applyRoomColors({
        floorColor: command.floorColor,
        wallColor: command.wallColor
      })
    }
  }
)

watch(templateEditorSlotId, (slotId) => {
  if (!slotId) return
  writeDraftFromSlot(slotId)
  templateEditorMessage.value = ''

  if (selectedRoot?.userData?.slotId === slotId) {
    updateTemplateDragBinding()
    return
  }

  const slot = slotStates.get(slotId)
  if (slot?.root) {
    select(slot.root)
  } else if (slot?.marker) {
    select(slot.marker)
  }
})

watch(templateSlotCategory, () => {
  const visibleSlots = filteredTemplateSlots.value
  if (!visibleSlots.length) return

  const currentVisible = visibleSlots.some((slot) => slot.id === templateEditorSlotId.value)
  if (!currentVisible) {
    templateEditorSlotId.value = visibleSlots[0].id
  }
})

watch(templateEditorOpen, (isOpen) => {
  if (!isOpen) {
    templateDragEnabled.value = false
  }
  updateTemplateDragBinding()
})

watch(templateDragEnabled, () => {
  updateTemplateDragBinding()
})

watch(templateDragMode, () => {
  updateTemplateDragBinding()
})

onMounted(() => {
  createScene()
  writeDraftFromSlot(templateEditorSlotId.value)
  sceneReady.value = true
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)

  try {
    renderer?.domElement?.removeEventListener('pointerdown', onPointerDown)
    renderer?.domElement?.removeEventListener('pointermove', onPointerMove)
    renderer?.domElement?.removeEventListener('pointerup', onPointerUp)
    renderer?.domElement?.removeEventListener('pointercancel', onPointerUp)
  } catch {
    // ignore
  }

  transform?.detach()
  renderer?.setAnimationLoop(null)
  renderer?.dispose()

  // Best-effort cleanup.
  if (renderer?.domElement && containerEl.value?.contains(renderer.domElement)) {
    containerEl.value.removeChild(renderer.domElement)
  }

  renderer = null
  scene = null
  camera = null
  orbit = null
  transform = null
  raycaster = null
  pointer = null
})
</script>

<template>
  <div class="relative h-full w-full">
    <div ref="containerEl" class="h-full w-full"></div>
    <div
      class="rounded bg-black/80 px-3 py-2 text-xs text-white"
      style="position: fixed; right: 14px; bottom: 18px; z-index: 2200; width: min(360px, calc(100vw - 28px)); max-height: min(72vh, 640px); overflow: auto; border: 1px solid rgba(255,255,255,0.16); box-shadow: 0 18px 40px rgba(0,0,0,0.45);"
    >
      <button
        type="button"
        style="width: 100%; border: 1px solid rgba(255,255,255,0.35); padding: 6px 8px; border-radius: 6px; background: rgba(255,255,255,0.08); color: #fff;"
        @click="templateEditorOpen = !templateEditorOpen"
      >
        {{ templateEditorOpen ? 'Template editor sluiten' : 'Template editor openen' }}
      </button>

      <div v-if="templateEditorOpen" style="margin-top: 10px; display: grid; gap: 8px;">
        <div style="display: grid; gap: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span>Categorie</span>
            <span style="padding: 2px 8px; border-radius: 999px; background: rgba(255,255,255,0.12); color: #fff; font-size: 11px;">
              {{ templateSlotCategory }}
            </span>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            <button
              v-for="category in TEMPLATE_SLOT_EDITOR_CATEGORIES"
              :key="category"
              type="button"
              style="padding: 5px 8px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.22); background: rgba(255,255,255,0.08); color: #fff;"
              :style="templateSlotCategory === category ? 'background: #1f5eff; border-color: #1f5eff;' : ''"
              @click="templateSlotCategory = category"
            >
              {{ category }}
            </button>
          </div>
        </div>

        <label style="display: grid; gap: 4px;">
          <span>Slot</span>
          <select v-model="templateEditorSlotId" style="padding: 6px; border-radius: 6px; background: #0f1720; color: #fff; border: 1px solid rgba(255,255,255,0.2);">
            <option v-for="slot in filteredTemplateSlots" :key="slot.id" :value="slot.id">
              {{ slot.label || slot.id }}
            </option>
          </select>
        </label>

        <div style="display: grid; gap: 4px;">
          <span>Slot categorieën</span>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            <label
              v-for="category in TEMPLATE_SLOT_EDITOR_CATEGORIES.filter((item) => item !== 'Alle')"
              :key="category"
              style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.06);"
            >
              <input v-model="templateDraft.slotCategories" type="checkbox" :value="category" />
              <span>{{ category }}</span>
            </label>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;">
          <label style="display: grid; gap: 4px;">
            <span>X</span>
            <input v-model="templateDraft.x" type="number" step="0.1" style="padding: 6px; border-radius: 6px; background: #0f1720; color: #fff; border: 1px solid rgba(255,255,255,0.2);" />
          </label>
          <label style="display: grid; gap: 4px;">
            <span>Z</span>
            <input v-model="templateDraft.z" type="number" step="0.1" style="padding: 6px; border-radius: 6px; background: #0f1720; color: #fff; border: 1px solid rgba(255,255,255,0.2);" />
          </label>
          <label style="display: grid; gap: 4px;">
            <span>Y</span>
            <input v-model="templateDraft.y" type="number" step="0.1" style="padding: 6px; border-radius: 6px; background: #0f1720; color: #fff; border: 1px solid rgba(255,255,255,0.2);" />
          </label>
          <label style="display: grid; gap: 4px;">
            <span>Rotatie (deg)</span>
            <input v-model="templateDraft.rotationDeg" type="number" step="1" style="padding: 6px; border-radius: 6px; background: #0f1720; color: #fff; border: 1px solid rgba(255,255,255,0.2);" />
          </label>
        </div>

        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <label><input v-model="templateDraft.acceptsMeubel" type="checkbox" /> meubel</label>
          <label><input v-model="templateDraft.acceptsPersoonlijk" type="checkbox" /> persoonlijk</label>
          <label><input v-model="templateDraft.acceptsDecoratie" type="checkbox" /> decoratie</label>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;">
          <button type="button" style="padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: #fff;" @click="applyTemplateDraft">
            Toepassen
          </button>
          <button type="button" style="padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: #fff;" @click="createNewTemplateSlot">
            Nieuw slot toevoegen
          </button>
          <button type="button" style="padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: #fff;" @click="saveTemplateToLocalStorage">
            Lokaal opslaan
          </button>
          <button type="button" style="padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: #fff; grid-column: 1 / -1;" @click="resetTemplateDefaults">
            Reset template
          </button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;">
          <button
            type="button"
            style="padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: #fff;"
            @click="toggleTemplateDrag"
          >
            {{ templateDragEnabled ? 'Verslepen uit' : 'Verslepen aan' }}
          </button>
          <button
            type="button"
            style="padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: #fff;"
            @click="setTemplateDragMode('translate')"
          >
            Verplaatsen
          </button>
          <button
            type="button"
            style="padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: #fff;"
            @click="setTemplateDragMode('rotate')"
          >
            Roteren
          </button>
        </div>

        <div style="font-size: 11px; color: rgba(255,255,255,0.8);">
          Tip: kies een slot, zet verslepen aan, en sleep direct in de scene.
        </div>

        <div v-if="templateEditorMessage" style="color: #d8f3dc; font-size: 11px;">
          {{ templateEditorMessage }}
        </div>
      </div>
    </div>

    <div
      class="pointer-events-none rounded bg-black/70 px-3 py-2 text-xs text-white"
      style="position: fixed; top: 108px; right: 14px; z-index: 120; min-width: 230px;"
    >
      <div>Camera: {{ cameraCoords }}</div>
      <div>Target: {{ targetCoords }}</div>
    </div>
  </div>
</template>
