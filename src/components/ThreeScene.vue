<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { startGlobalLoading, endGlobalLoading } from '../services/globalLoading.js'
import { adaptStaticAssetUrl, fetchModels, getPolyPizzaCategories } from '../services/polyPizzaService.js'
import { ROOM_TEMPLATE } from '../services/roomTemplate.js'
import { DEFAULT_ROOM_FLOOR_COLOR, DEFAULT_ROOM_WALL_COLOR } from '../services/roomAppearanceDefaults.js'
import { DEFAULT_FLOOR_TEXTURE_ID, DEFAULT_WALL_TEXTURE_ID, FLOOR_TEXTURE_PRESETS, WALL_TEXTURE_PRESETS, createFloorTexture, createWallTexture, getFloorTextureDefaults, getWallTextureDefaults, normalizeFloorTextureId, normalizeSurfaceTextureColors, normalizeWallTextureId } from '../services/roomSurfaceTextures.js'

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
  },
  canEditTemplate: {
    type: Boolean,
    default: false
  },
  adminMode: {
    type: Boolean,
    default: false
  },
  useStoredTemplate: {
    type: Boolean,
    default: true
  },
  hideLocalTemplateActions: {
    type: Boolean,
    default: false
  },
  vrMode: {
    type: Boolean,
    default: false
  },
  vrItems: {
    type: Array,
    default: () => []
  },
  roomContributions: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['selected', 'selected-anchor', 'slot-markers', 'load-error', 'contribution-candle-selected', 'scene-mutated'])

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
let isRestoringHistory = false
const sceneHistoryStack = []
let sceneHistoryIndex = -1

// VR camera rotation
let vrYaw = 0
let vrPitch = 0
let vrIsDragging = false
let vrDragStartX = 0
let vrDragStartY = 0

const selectableRoots = []
const contributionCandleRoots = []
let selectedRoot = null
let positionEditMode = false
let positionEditTargetUuid = ''
let positionEditStartTransform = null

const sceneReady = ref(false)
const canEditTemplate = computed(() => props.canEditTemplate === true)
const adminMode = computed(() => props.adminMode === true)
// Debug/test helper: 'off' | 'canvas-red' | 'cover-red'
const debugMode = ref('off')

// expose quick debug API: call from browser console
if (typeof window !== 'undefined') {
  window.__threeSceneDebug = {
    set(mode) {
      debugMode.value = mode
      console.info('[ThreeScene] debugMode ->', mode)
    }
  }
}

onMounted(() => {
  console.info('[ThreeScene] mounted - debug API present:', !!window?.__threeSceneDebug)
})

const loader = new GLTFLoader()

// Keep incoming assets within a predictable furniture-like size range.
const MODEL_SIZE_TARGET = 5.4
const SMALL_DECOR_TARGET_SIZE = 2.2
const TABLE_TARGET_SIZE = 7.0
const MODEL_SCALE_MIN = 0.01
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
const CONTRIBUTION_CANDLE_RADIUS = ROOM_SIZE * 0.55
const CONTRIBUTION_CANDLE_RING_Y = WALL_HEIGHT + 0.35
const CONTRIBUTION_CANDLE_HEIGHT = 1.15
const CONTRIBUTION_CANDLE_SCALE = 2.48
const CONTRIBUTION_CANDLE_MIN_FLAME_INTENSITY = 0.2
const CONTRIBUTION_CANDLE_MAX_FLAME_INTENSITY = 0.45
const CONTRIBUTION_CANDLE_GROUP_POSITIONS = [
  new THREE.Vector3(-27.2, 0, 0),
  new THREE.Vector3(0, 0, 26.43)
]
const DEFAULT_FLOOR_COLOR = DEFAULT_ROOM_FLOOR_COLOR
const DEFAULT_WALL_COLOR = DEFAULT_ROOM_WALL_COLOR
const ROOM_TEMPLATE_STORAGE_KEY = 'noek.room-template.v1'
const ROOM_TEMPLATE_DELETED_KEY = `${ROOM_TEMPLATE_STORAGE_KEY}.deleted`
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

let floorTexture = null
let wallTexture = null
let sideWallTexture = null
let floorTextureId = DEFAULT_FLOOR_TEXTURE_ID
let wallTextureId = DEFAULT_WALL_TEXTURE_ID
let floorTextureColorsById = {}
let wallTextureColorsById = {}
let floorTexturePaletteKey = ''
let wallTexturePaletteKey = ''

function normalizeTextureColorMap(surface, value = {}) {
  const out = {}
  for (const [textureId, colors] of Object.entries(value || {})) {
    out[textureId] = normalizeSurfaceTextureColors(surface, textureId, colors)
  }
  return out
}

function getTexturePalette(surface, textureId, paletteMap) {
  const defaults = surface === 'wall' ? getWallTextureDefaults(textureId) : getFloorTextureDefaults(textureId)
  return normalizeSurfaceTextureColors(surface, textureId, paletteMap?.[textureId] || defaults)
}

function paletteKey(palette) {
  return `${palette?.primaryColor || ''}|${palette?.secondaryColor || ''}`
}

function createTextureCanvas(size, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return null

  draw(context, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

function createWoodFloorTexture() {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = '#9f6f42'
    context.fillRect(0, 0, size, size)

    const plankCount = 6
    const plankWidth = size / plankCount

    for (let i = 0; i < plankCount; i++) {
      const x = Math.floor(i * plankWidth)
      const shade = i % 2 === 0 ? '#b47b4c' : '#a36c41'
      context.fillStyle = shade
      context.fillRect(x, 0, Math.ceil(plankWidth), size)

      context.strokeStyle = 'rgba(75, 42, 18, 0.34)'
      context.lineWidth = 4
      context.beginPath()
      context.moveTo(x + 1, 0)
      context.lineTo(x + 1, size)
      context.stroke()

      context.fillStyle = 'rgba(255, 245, 225, 0.08)'
      for (let y = 14; y < size; y += 24) {
        context.fillRect(x + 4, y, Math.max(plankWidth - 8, 1), 2)
      }
    }

    context.fillStyle = 'rgba(46, 25, 11, 0.18)'
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const w = 1 + Math.random() * 2
      const h = 1 + Math.random() * 8
      context.fillRect(x, y, w, h)
    }
  })
}

function createWallpaperTexture() {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = '#efe4d6'
    context.fillRect(0, 0, size, size)

    const stripeWidth = 48
    for (let x = 0; x < size; x += stripeWidth) {
      context.fillStyle = x % (stripeWidth * 2) === 0 ? 'rgba(164, 132, 105, 0.08)' : 'rgba(255, 255, 255, 0.06)'
      context.fillRect(x, 0, stripeWidth, size)
    }

    context.strokeStyle = 'rgba(134, 96, 64, 0.12)'
    context.lineWidth = 2
    for (let y = 24; y < size; y += 48) {
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(size, y)
      context.stroke()
    }

    const patternColor = 'rgba(131, 89, 70, 0.22)'
    for (let y = 32; y < size; y += 64) {
      for (let x = 32; x < size; x += 64) {
        context.fillStyle = patternColor
        context.beginPath()
        context.arc(x, y, 5, 0, Math.PI * 2)
        context.fill()

        context.beginPath()
        context.moveTo(x - 10, y)
        context.lineTo(x + 10, y)
        context.moveTo(x, y - 10)
        context.lineTo(x, y + 10)
        context.stroke()
      }
    }
  })
}

function createTileTexture() {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = '#ddd6cd'
    context.fillRect(0, 0, size, size)

    const tile = 64
    context.strokeStyle = 'rgba(92, 84, 73, 0.28)'
    context.lineWidth = 2

    for (let y = 0; y <= size; y += tile) {
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(size, y)
      context.stroke()
    }

    for (let x = 0; x <= size; x += tile) {
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x, size)
      context.stroke()
    }

    for (let y = 0; y < size; y += tile) {
      for (let x = 0; x < size; x += tile) {
        context.fillStyle = (x + y) % (tile * 2) === 0 ? 'rgba(180, 154, 132, 0.18)' : 'rgba(255, 255, 255, 0.08)'
        context.fillRect(x + 1, y + 1, tile - 2, tile - 2)
      }
    }
  })
}

function createStripedWallpaperTexture() {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = '#f2e9dc'
    context.fillRect(0, 0, size, size)

    for (let x = 0; x < size; x += 36) {
      context.fillStyle = x % 72 === 0 ? 'rgba(167, 126, 95, 0.12)' : 'rgba(255, 255, 255, 0.05)'
      context.fillRect(x, 0, 36, size)
    }

    context.strokeStyle = 'rgba(120, 91, 64, 0.12)'
    context.lineWidth = 1.5
    for (let y = 16; y < size; y += 32) {
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(size, y)
      context.stroke()
    }

    context.fillStyle = 'rgba(137, 98, 71, 0.14)'
    for (let i = 0; i < 1200; i++) {
      context.fillRect(Math.random() * size, Math.random() * size, 1, 1)
    }
  })
}

function createFabricTexture() {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = '#9a7861'
    context.fillRect(0, 0, size, size)

    context.strokeStyle = 'rgba(255, 244, 230, 0.16)'
    context.lineWidth = 1
    for (let y = 0; y < size; y += 8) {
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(size, y)
      context.stroke()
    }
    for (let x = 0; x < size; x += 8) {
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x, size)
      context.stroke()
    }

    context.fillStyle = 'rgba(62, 36, 26, 0.08)'
    for (let i = 0; i < 1800; i++) {
      context.fillRect(Math.random() * size, Math.random() * size, 1, 1)
    }
  })
}

function createDarkWoodTexture() {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = '#6f4b2f'
    context.fillRect(0, 0, size, size)

    for (let y = 0; y < size; y += 28) {
      const shade = y % 56 === 0 ? 'rgba(184, 126, 76, 0.16)' : 'rgba(52, 30, 17, 0.14)'
      context.fillStyle = shade
      context.fillRect(0, y, size, 14)
    }

    context.strokeStyle = 'rgba(255, 236, 212, 0.12)'
    context.lineWidth = 2
    for (let i = 0; i < 8; i++) {
      const y = (i * size) / 8
      context.beginPath()
      context.moveTo(0, y)
      context.quadraticCurveTo(size * 0.3, y + 8, size, y)
      context.stroke()
    }
  })
}

function createRattanTexture() {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = '#d3b58a'
    context.fillRect(0, 0, size, size)

    context.strokeStyle = 'rgba(104, 74, 43, 0.28)'
    context.lineWidth = 10
    for (let x = -size; x < size * 2; x += 28) {
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x + size, size)
      context.stroke()
    }
    for (let x = 0; x < size * 2; x += 28) {
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x - size, size)
      context.stroke()
    }

    context.strokeStyle = 'rgba(255, 247, 230, 0.1)'
    context.lineWidth = 2
    for (let y = 0; y < size; y += 42) {
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(size, y)
      context.stroke()
    }
  })
}

function createSlateTexture() {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = '#49515a'
    context.fillRect(0, 0, size, size)
    context.fillStyle = 'rgba(255, 255, 255, 0.06)'
    for (let i = 0; i < 1800; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const radius = 1 + Math.random() * 2
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fill()
    }
    context.strokeStyle = 'rgba(0, 0, 0, 0.2)'
    context.lineWidth = 2
    for (let y = 0; y < size; y += 64) {
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(size, y)
      context.stroke()
    }
  })
}

function createBaseMaterial(texture, color) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    color,
    roughness: 0.98,
    metalness: 0.0
  })
}

function setMaterialMap(material, texture) {
  if (!material) return
  const previous = material.map
  material.map = texture || null
  material.color.set(0xffffff)
  material.needsUpdate = true
  if (previous && previous !== texture && typeof previous.dispose === 'function') {
    previous.dispose()
  }
}

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
        initialModel: slot?.initialModel || null,
        markerSize: typeof slot?.markerSize === 'number' ? slot.markerSize : Number(slot?.markerSize) || 1,
        targetSize: typeof slot?.targetSize === 'number' ? slot.targetSize : Number(slot?.targetSize) || 0,
        modelScale: typeof slot?.modelScale === 'number' ? slot.modelScale : Number(slot?.modelScale) || Number(slot?.targetSize) || Number(slot?.markerSize) || 1
      }))
      .filter((slot) => String(slot?.id || '').trim())
    : []
}

function cloneTemplateSlots(slots = []) {
  return slots.map((slot) => ({
    ...slot,
    accepts: Array.isArray(slot?.accepts) ? [...slot?.accepts] : ['meubel'],
    categories: Array.isArray(slot?.categories) ? [...slot?.categories] : getDefaultTemplateCategories(slot?.id),
    position: slot?.position?.isVector3 ? slot.position.clone() : new THREE.Vector3(0, FLOOR_Y, 0),
    initialModel: slot?.initialModel ? { ...slot.initialModel } : null,
    markerSize: typeof slot?.markerSize === 'number' ? slot.markerSize : Number(slot?.markerSize) || 1,
    targetSize: typeof slot?.targetSize === 'number' ? slot.targetSize : Number(slot?.targetSize) || 0,
    modelScale: typeof slot?.modelScale === 'number' ? slot.modelScale : Number(slot?.modelScale) || Number(slot?.targetSize) || Number(slot?.markerSize) || 1
  }))
}

const BASE_TEMPLATE_SLOTS = normalizeTemplateSlots(ROOM_TEMPLATE?.slots || [])
const TEMPLATE_SLOTS = ref(cloneTemplateSlots(BASE_TEMPLATE_SLOTS))

const slotStates = new Map()
let floorMaterial = null
let wallMaterial = null
let sideWallMaterial = null
let tileMaterial = null
const templateEditorOpen = ref(true)
const templateEditorMessage = ref('')
const selectedTemplateTarget = ref(null)
const templateEditorSlotId = ref(TEMPLATE_SLOTS.value[0]?.id || '')
const templateSlotCategory = ref('Alle')
const templateDragEnabled = ref(false)
const templateDragMode = ref('translate')
const templateReplacementLoading = ref(false)
const templateReplacementError = ref('')
const templateReplacementSearch = ref('')
const templateReplacementModels = ref([])
const templateFloorTextureId = ref(DEFAULT_FLOOR_TEXTURE_ID)
const templateFloorPrimaryColor = ref(getFloorTextureDefaults(DEFAULT_FLOOR_TEXTURE_ID).primaryColor)
const templateFloorSecondaryColor = ref(getFloorTextureDefaults(DEFAULT_FLOOR_TEXTURE_ID).secondaryColor)
const templateWallTextureId = ref(DEFAULT_WALL_TEXTURE_ID)
const templateWallPrimaryColor = ref(getWallTextureDefaults(DEFAULT_WALL_TEXTURE_ID).primaryColor)
const templateWallSecondaryColor = ref(getWallTextureDefaults(DEFAULT_WALL_TEXTURE_ID).secondaryColor)
const templateDraft = ref({
  x: 0,
  y: 0,
  z: 0,
  rotationDeg: 0,
  slotCategories: ['Zetel'],
  acceptsMeubel: true,
  acceptsPersoonlijk: false,
  acceptsDecoratie: false,
  markerSize: 1,
  modelScale: 1,
  targetSize: 5.4
})
let isSyncingSlotFromTransform = false

const TEMPLATE_SLOT_EDITOR_CATEGORIES = ref(['Alle', 'Zetel', 'Lamp', 'Tafel', 'Kast', 'Muurdecoratie', 'Decoratie klein', 'Decoratie groot', 'Persoonlijk', 'Media'])

onMounted(async () => {
  try {
    const categories = await getPolyPizzaCategories()
    if (Array.isArray(categories) && categories.length) {
      TEMPLATE_SLOT_EDITOR_CATEGORIES.value = ['Alle', ...categories.filter((c) => c !== 'Alle')]
    }
  } catch {
    // ignore and keep fallback
  }
})

const filteredReplacementModels = computed(() => {
  const query = String(templateReplacementSearch.value || '').trim().toLowerCase()
  if (!query) return templateReplacementModels.value

  return templateReplacementModels.value.filter((model) => {
    const title = String(model?.title || '').toLowerCase()
    const id = String(model?.id || '').toLowerCase()
    const category = String(model?.modelCategory || '').toLowerCase()
    return title.includes(query) || id.includes(query) || category.includes(query)
  })
})

function getTemplateReplacementPreview(model) {
  return model?.thumbnailUrl || model?.previewUrl || model?.Thumbnail || model?.preview || ''
}

function syncTemplateSurfaceEditorFromScene() {
  const nextFloorTextureId = normalizeFloorTextureId(floorTextureId)
  const nextWallTextureId = normalizeWallTextureId(wallTextureId)
  const nextFloorPalette = getTexturePalette('floor', nextFloorTextureId, floorTextureColorsById)
  const nextWallPalette = getTexturePalette('wall', nextWallTextureId, wallTextureColorsById)

  templateFloorTextureId.value = nextFloorTextureId
  templateFloorPrimaryColor.value = nextFloorPalette.primaryColor
  templateFloorSecondaryColor.value = nextFloorPalette.secondaryColor
  templateWallTextureId.value = nextWallTextureId
  templateWallPrimaryColor.value = nextWallPalette.primaryColor
  templateWallSecondaryColor.value = nextWallPalette.secondaryColor
}

function applyTemplateSurfaceTexture(surface, textureId) {
  const normalizedTextureId = surface === 'wall' ? normalizeWallTextureId(textureId) : normalizeFloorTextureId(textureId)

  const nextFloorTextureId = surface === 'floor' ? normalizedTextureId : normalizeFloorTextureId(floorTextureId)
  const nextWallTextureId = surface === 'wall' ? normalizedTextureId : normalizeWallTextureId(wallTextureId)
  const nextFloorPalette = surface === 'floor'
    ? normalizeSurfaceTextureColors('floor', normalizedTextureId, getFloorTextureDefaults(normalizedTextureId))
    : getTexturePalette('floor', nextFloorTextureId, floorTextureColorsById)
  const nextWallPalette = surface === 'wall'
    ? normalizeSurfaceTextureColors('wall', normalizedTextureId, getWallTextureDefaults(normalizedTextureId))
    : getTexturePalette('wall', nextWallTextureId, wallTextureColorsById)

  applyRoomColors({
    floorTextureId: nextFloorTextureId,
    wallTextureId: nextWallTextureId,
    floorTextureColorsById: surface === 'floor'
      ? {
          ...floorTextureColorsById,
          [normalizedTextureId]: nextFloorPalette
        }
      : floorTextureColorsById,
    wallTextureColorsById: surface === 'wall'
      ? {
          ...wallTextureColorsById,
          [normalizedTextureId]: nextWallPalette
        }
      : wallTextureColorsById
  })

  syncTemplateSurfaceEditorFromScene()
}

function updateTemplateSurfaceColor(surface, field, value) {
  const textureId = surface === 'wall' ? normalizeWallTextureId(templateWallTextureId.value) : normalizeFloorTextureId(templateFloorTextureId.value)
  const currentPalette = surface === 'wall'
    ? normalizeSurfaceTextureColors('wall', textureId, getTexturePalette('wall', textureId, wallTextureColorsById))
    : normalizeSurfaceTextureColors('floor', textureId, getTexturePalette('floor', textureId, floorTextureColorsById))
  const nextPalette = normalizeSurfaceTextureColors(surface, textureId, {
    ...currentPalette,
    [field]: value
  })

  if (surface === 'wall') {
    templateWallTextureId.value = textureId
    templateWallPrimaryColor.value = nextPalette.primaryColor
    templateWallSecondaryColor.value = nextPalette.secondaryColor
  } else {
    templateFloorTextureId.value = textureId
    templateFloorPrimaryColor.value = nextPalette.primaryColor
    templateFloorSecondaryColor.value = nextPalette.secondaryColor
  }

  applyRoomColors({
    floorTextureId: normalizeFloorTextureId(surface === 'floor' ? textureId : floorTextureId),
    wallTextureId: normalizeWallTextureId(surface === 'wall' ? textureId : wallTextureId),
    floorTextureColorsById: surface === 'floor'
      ? {
          ...floorTextureColorsById,
          [textureId]: nextPalette
        }
      : floorTextureColorsById,
    wallTextureColorsById: surface === 'wall'
      ? {
          ...wallTextureColorsById,
          [textureId]: nextPalette
        }
      : wallTextureColorsById
  })

  syncTemplateSurfaceEditorFromScene()
}

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

function getTemplateSlotDisplayLabel(slot) {
  const baseLabel = String(slot?.label || slot?.id || '').trim()
  const categories = getTemplateEditorSlotCategories(slot)
  if (!categories.length) return baseLabel
  return `${baseLabel} — ${categories.join(', ')}`
}

function resolveTemplateSlotCategories(slot = getTemplateSlot()) {
  const draftCategories = normalizeCategoryList(templateDraft.value?.slotCategories || [])
  if (draftCategories.length) return draftCategories

  const selectedCategories = normalizeCategoryList(getTemplateEditorSlotCategories(slot))
  if (selectedCategories.length) return selectedCategories

  const activeCategory = String(templateSlotCategory.value || '').trim()
  if (activeCategory && activeCategory !== 'Alle') {
    return [activeCategory]
  }

  return ['Decoratie groot']
}

function syncTemplateSlotCategories(slotId, categories) {
  const normalizedSlotId = String(slotId || '').trim()
  if (!normalizedSlotId) return

  const nextCategories = normalizeCategoryList(categories)
  if (!nextCategories.length) return

  const slot = getTemplateSlot(normalizedSlotId)
  if (!slot) return

  slot.categories = [...nextCategories]

  const slotState = slotStates.get(normalizedSlotId)
  if (slotState) {
    slotState.categories = [...nextCategories]
    if (slotState.root) {
      slotState.root.userData = slotState.root.userData || {}
      slotState.root.userData.slotCategories = [...nextCategories]
    }
    if (slotState.marker) {
      slotState.marker.userData = slotState.marker.userData || {}
      slotState.marker.userData.slotCategories = [...nextCategories]
    }
  }

  if (selectedRoot?.userData?.slotId === normalizedSlotId) {
    selectedRoot.userData = selectedRoot.userData || {}
    selectedRoot.userData.slotCategories = [...nextCategories]
  }

  if (String(templateEditorSlotId.value || '') === normalizedSlotId) {
    templateDraft.value = {
      ...templateDraft.value,
      slotCategories: [...nextCategories]
    }
  }

  applyTemplateSlotToScene(normalizedSlotId)
}

function matchesTemplateCategoryFilter(slot, filter = templateSlotCategory.value) {
  if (filter === 'Alle') return true
  return getTemplateEditorSlotCategories(slot).includes(filter)
}

const filteredTemplateSlots = computed(() => {
  const visibleSlots = TEMPLATE_SLOTS.value.filter((slot) => matchesTemplateCategoryFilter(slot))
  const activeSlotId = String(templateEditorSlotId.value || '').trim()
  if (!activeSlotId) return visibleSlots

  const activeSlot = TEMPLATE_SLOTS.value.find((slot) => slot.id === activeSlotId)
  if (!activeSlot) return visibleSlots

  if (visibleSlots.some((slot) => slot.id === activeSlotId)) return visibleSlots

  return [...visibleSlots, activeSlot]
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
    acceptsDecoratie: accepts.includes('decoratie') || accepts.includes('alles'),
    markerSize: typeof slot.markerSize === 'number' ? slot.markerSize : Number(slot.markerSize) || 1,
    modelScale: typeof slot.modelScale === 'number' ? slot.modelScale : Number(slot.modelScale) || Number(slot.targetSize) || Number(slot.markerSize) || 1,
    targetSize: Number(slot.targetSize) || Number(slot.modelScale) || Number(slot.markerSize) || 1
  }
}

function deleteTemplateSlot(slotId = templateEditorSlotId.value) {
  if (!canEditTemplate.value) return
  if (TEMPLATE_SLOTS.value.length <= 1) {
    templateEditorMessage.value = 'Minstens één slot moet blijven bestaan.'
    return
  }

  const selectedSlotId = String(
    selectedRoot?.userData?.slotId ||
    selectedRoot?.slotId ||
    selectedTemplateTarget.value?.slotId ||
    ''
  ).trim()

  if (slotId && typeof slotId === 'object') {
    slotId = templateEditorSlotId.value
  }

  slotId = String(selectedSlotId || slotId || templateEditorSlotId.value || '').trim()

  const slot = getTemplateSlot(slotId)
  if (!slot) {
    if (slotId) {
      purgeSlotObjects(slotId)
      saveTemplateToLocalStorage()
      emit('scene-mutated')
      templateEditorMessage.value = `Restanten van slot "${slotId}" verwijderd.`
    } else {
      templateEditorMessage.value = 'Geen slot geselecteerd om te verwijderen.'
    }
    return
  }

  const label = getTemplateSlotDisplayLabel(slot)
  if (typeof window !== 'undefined' && !window.confirm(`Slot "${label}" verwijderen?`)) {
    return
  }

  purgeSlotObjects(slot.id)
  slotStates.delete(slot.id)
  TEMPLATE_SLOTS.value = TEMPLATE_SLOTS.value.filter((item) => item.id !== slot.id)

  // Persist deletion so slot blijft verwijderd, ook na herladen.
  try {
    addDeletedTemplateSlot(slot.id)
  } catch {
    // ignore
  }

  rebuildTemplateSlotScene({ hydrateCurated: true })
  saveTemplateToLocalStorage()
  emit('scene-mutated')

  let fallbackSlot = filteredTemplateSlots.value[0] || null
  if (!fallbackSlot) {
    templateSlotCategory.value = 'Alle'
    fallbackSlot = TEMPLATE_SLOTS.value[0] || null
  }

  if (fallbackSlot) {
    templateEditorSlotId.value = fallbackSlot.id
    if (templateSlotCategory.value !== 'Alle' && !matchesTemplateCategoryFilter(fallbackSlot, templateSlotCategory.value)) {
      templateSlotCategory.value = getTemplateEditorSlotCategories(fallbackSlot)[0] || 'Alle'
    }
    writeDraftFromSlot(fallbackSlot.id)
  }

  templateEditorMessage.value = `Slot "${label}" verwijderd.`
}

async function loadTemplateReplacementModels() {
  if (!canEditTemplate.value || templateReplacementLoading.value) return

  templateReplacementLoading.value = true
  templateReplacementError.value = ''

  try {
    const result = await fetchModels({ max: 80 })
    templateReplacementModels.value = Array.isArray(result?.models) ? result.models : []
    if (!templateReplacementModels.value.length) {
      templateReplacementError.value = String(result?.error || 'Geen vervangmodellen gevonden.')
    }
  } catch (error) {
    templateReplacementModels.value = []
    templateReplacementError.value = error?.message || 'Kon vervangmodellen niet laden.'
  } finally {
    templateReplacementLoading.value = false
  }
}

async function replaceSelectedTemplateObject(model) {
  if (!canEditTemplate.value) return

  if (!selectedRoot) {
    templateEditorMessage.value = 'Klik eerst op een object in de kamer om het te vervangen.'
    return
  }

  const url = model?.url || model?.downloadUrl || model?.Download || ''
  if (!url) {
    templateEditorMessage.value = 'Het gekozen model mist een download-URL.'
    return
  }

  const selectedSlotId = String(selectedRoot?.userData?.slotId || '').trim()
  const selectedSlot = selectedSlotId ? slotStates.get(selectedSlotId) || null : null
  const preservedTargetSize = Number(selectedRoot?.userData?.targetSize) || Number(selectedSlot?.targetSize) || 0

  try {
    templateEditorMessage.value = ''
    await loadModelAssetWithFallback({
      url: adaptStaticAssetUrl(url),
      title: model?.title || model?.Title || 'Vervangmodel',
      id: model?.id || model?.ID || '',
      replaceRoot: selectedRoot,
      transform: {
        fixedTargetSize: preservedTargetSize > 0 ? preservedTargetSize : undefined,
        sizeMultiplier: 1,
        modelCategory: model?.modelCategory || ''
      }
    })
    templateEditorMessage.value = `Object vervangen door ${model?.title || model?.Title || 'nieuw model'}.`
  } catch (error) {
    templateEditorMessage.value = error?.message || 'Vervangen mislukt.'
  }
}

function applyTemplateSlotToScene(slotId) {
  const slot = getTemplateSlot(slotId)
  const slotState = slotStates.get(slotId) || {}
  if (!slot || !slotState) return

  isSyncingSlotFromTransform = true

  slotState.position = slot.position.clone()
  slotState.rotationY = slot.rotationY
  slotState.label = getTemplateSlotDisplayLabel(slot)
  slotState.accepts = Array.isArray(slot.accepts) ? [...slot.accepts] : ['meubel']
  slotState.categories = getTemplateEditorSlotCategories(slot)
  slotState.targetSize = Number(slot.targetSize) || 0

  if (slotState.root && slotState.root.userData) {
    slotState.root.position.set(slot.position.x, slot.position.y, slot.position.z)
    const yOffset = Number(slotState.root.userData?.rotationYOffset || 0)
    slotState.root.rotation.set(0, slot.rotationY + yOffset, 0)
    slotState.root.userData.slotLabel = slotState.label
    slotState.root.userData.slotAccepts = [...slotState.accepts]
    slotState.root.userData.slotCategories = [...slotState.categories]
    slotState.root.userData.targetSize = Number(slot.targetSize) || slotState.root.userData.targetSize || 0
  }

  if (slotState.marker && slotState.marker.userData) {
    slotState.marker.position.set(slot.position.x, slot.position.y, slot.position.z)
    slotState.marker.rotation.set(0, slot.rotationY, 0)
    slotState.marker.userData.slotLabel = slotState.label
    slotState.marker.userData.slotAccepts = [...slotState.accepts]
    slotState.marker.userData.slotCategories = [...slotState.categories]
    slotState.marker.userData.title = `Plaats hier (${slotState.label})`
    // Update marker scale if slot has markerSize
    try {
      const ms = Number(slot.markerSize) || 1
      slotState.marker.scale.set(ms, ms, ms)
    } catch (err) {
      // ignore invalid markerSize
    }
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

  // allow vertical positioning for wall decor and small decorations
  const allowVertical = isVerticalDecorationSlot(slotId)
  slot.position.set(root.position.x, allowVertical ? root.position.y : FLOOR_Y, root.position.z)
  slot.rotationY = root.rotation.y - Number(root.userData?.rotationYOffset || 0)

  applyTemplateSlotToScene(slotId)
  templateEditorSlotId.value = slotId
  writeDraftFromSlot(slotId)
}

function getPositionEditTargetRoot() {
  if (!positionEditTargetUuid) return null
  if (selectedRoot?.uuid === positionEditTargetUuid) return selectedRoot
  return getRootByUuid(positionEditTargetUuid)
}

function beginPositionEditMode() {
  if (!selectedRoot || selectedRoot.userData?.isSlotMarker) return false
  positionEditMode = true
  positionEditTargetUuid = String(selectedRoot.uuid || '')
  positionEditStartTransform = {
    position: selectedRoot.position.clone(),
    rotation: selectedRoot.rotation.clone()
  }
  updateTemplateDragBinding()
  return true
}

function finishPositionEditMode({ commit }) {
  if (!positionEditMode) return false
  const targetRoot = getPositionEditTargetRoot()

  if (targetRoot) {
    if (commit) {
      syncSlotFromRoot(targetRoot)
      if (!isRestoringHistory) {
        pushSceneHistorySnapshot()
      }
      emit('scene-mutated')
    } else if (positionEditStartTransform?.position && positionEditStartTransform?.rotation) {
      targetRoot.position.copy(positionEditStartTransform.position)
      targetRoot.rotation.copy(positionEditStartTransform.rotation)
      syncSlotFromRoot(targetRoot)
    }
  }

  positionEditMode = false
  positionEditTargetUuid = ''
  positionEditStartTransform = null
  updateTemplateDragBinding()
  updateSelectedAnchor()
  return true
}

function updateTemplateDragBinding() {
  if (!transform) {
    return
  }

  if (positionEditMode) {
    const targetRoot = getPositionEditTargetRoot()
    if (!targetRoot || targetRoot.userData?.isSlotMarker) {
      transform.detach()
      transform.visible = false
      transform.enabled = false
      return
    }

    transform.setMode('translate')
    transform.setSpace('world')
    transform.translationSnap = 0.25
    transform.showX = true
    transform.showY = true
    transform.showZ = true
    transform.attach(targetRoot)
    transform.visible = true
    transform.enabled = true
    return
  }

  if (!canEditTemplate.value) {
    transform?.detach()
    if (transform) {
      transform.visible = false
      transform.enabled = false
    }
    return
  }

  if (!templateDragEnabled.value || !selectedRoot?.userData?.slotId) {
    transform.detach()
    transform.visible = false
    transform.enabled = false
    return
  }

  transform.setMode(templateDragMode.value)
  // enable vertical axis for wall decor and small decorations when translating
  try {
    const allowY = templateDragMode.value === 'translate' && selectedRoot && isVerticalDecorationSlot(selectedRoot.userData?.slotId)
    transform.showX = true
    transform.showY = Boolean(allowY)
    transform.showZ = true
  } catch (err) {
    transform.showX = true
    transform.showY = false
    transform.showZ = true
  }
  transform.attach(selectedRoot)
  transform.visible = true
  transform.enabled = true
}

function toggleTemplateDrag() {
  if (!canEditTemplate.value) return
  templateDragEnabled.value = !templateDragEnabled.value
  updateTemplateDragBinding()
}

function setTemplateDragMode(mode) {
  if (!canEditTemplate.value) return
  if (mode !== 'translate' && mode !== 'rotate') return
  templateDragMode.value = mode
  updateTemplateDragBinding()
}

function applyTemplateDraft() {
  if (!canEditTemplate.value) return
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

  const resolvedSlotCategories = slotCategories.length ? slotCategories : resolveTemplateSlotCategories(slot)

  const elevatedCategories = new Set(['Muurdecoratie', 'Decoratie klein'])
  const yValue = elevatedCategories.has(resolvedSlotCategories[0]) || resolvedSlotCategories.some((category) => elevatedCategories.has(category)) ? y : FLOOR_Y
  const slotState = slotStates.get(slot.id)
  slot.position.set(x, yValue, z)
  slot.rotationY = (rotationDeg * Math.PI) / 180
  slot.accepts = accepts
  slot.categories = resolvedSlotCategories
  const markerSizeValue = Number(templateDraft.value.markerSize)
  const modelScaleValue = Number(templateDraft.value.modelScale)
  const nextSize = Number.isFinite(markerSizeValue) && markerSizeValue > 0
    ? markerSizeValue
    : Number.isFinite(modelScaleValue) && modelScaleValue > 0
      ? modelScaleValue
      : Number(slot.targetSize) || 1

  slot.markerSize = nextSize
  slot.modelScale = nextSize
  slot.targetSize = nextSize
  if (slot.initialModel) {
    slot.initialModel = {
      ...slot.initialModel,
      scaleMultiplier: nextSize
    }
  }
  if (slotState?.root) {
    centerAndGround(slotState.root, nextSize)
    slotState.root.userData = slotState.root.userData || {}
    slotState.root.userData.sizeMultiplier = 1
    slotState.root.userData.appliedModelScale = 1
  }
  if (slotState) {
    slotState.targetSize = nextSize
    if (slotState.root?.userData) {
      slotState.root.userData.targetSize = nextSize
    }
  }
  templateDraft.value.markerSize = nextSize
  templateDraft.value.modelScale = nextSize
  templateDraft.value.targetSize = nextSize
  applyTemplateSlotToScene(slot.id)
  templateDraft.value.y = yValue
  templateEditorMessage.value = 'Template slot bijgewerkt.'
  emit('scene-mutated')
}

function createNewTemplateSlot() {
  if (!canEditTemplate.value) return
  const currentSlot = getTemplateSlot()
  const currentCategories = resolveTemplateSlotCategories(currentSlot)
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
    initialModel: currentSlot?.initialModel ? { ...currentSlot.initialModel, scaleMultiplier: Number(templateDraft.value.modelScale) || Number(templateDraft.value.targetSize) || Number(currentSlot?.modelScale) || 5.4 } : null,
    targetSize: Number(templateDraft.value.targetSize) || Number(templateDraft.value.modelScale) || Number(currentSlot?.targetSize) || 5.4,
    modelScale: Number(templateDraft.value.modelScale) || Number(templateDraft.value.targetSize) || Number(currentSlot?.modelScale) || 5.4
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
    targetSize: Number(newSlot.targetSize) || 0,
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
  emit('scene-mutated')
}

function syncSlotTargetSizesFromScene() {
  for (const slot of TEMPLATE_SLOTS.value) {
    const slotId = String(slot?.id || '').trim()
    if (!slotId) continue

    const slotState = slotStates.get(slotId)
    const rootTargetSize = Number(slotState?.root?.userData?.targetSize)
    const stateTargetSize = Number(slotState?.targetSize)
    const slotTargetSize = Number(slot?.targetSize)

    const resolvedTargetSize = Number.isFinite(rootTargetSize) && rootTargetSize > 0
      ? rootTargetSize
      : Number.isFinite(stateTargetSize) && stateTargetSize > 0
        ? stateTargetSize
        : Number.isFinite(slotTargetSize) && slotTargetSize > 0
          ? slotTargetSize
          : 0

    if (resolvedTargetSize <= 0) continue

    slot.targetSize = resolvedTargetSize
    slot.modelScale = resolvedTargetSize
    if (slot.initialModel) {
      slot.initialModel = {
        ...slot.initialModel,
        scaleMultiplier: resolvedTargetSize
      }
    }

    if (slotState) {
      slotState.targetSize = resolvedTargetSize
      if (slotState.root) {
        slotState.root.userData = slotState.root.userData || {}
        slotState.root.userData.targetSize = resolvedTargetSize
      }
    }
  }
}

function getTemplateSnapshot() {
  syncSlotTargetSizesFromScene()
  return TEMPLATE_SLOTS.value
    .map((slot) => ({
    id: slot.id,
    label: slot.label,
    accepts: Array.isArray(slot.accepts) ? [...slot.accepts] : ['meubel'],
    categories: getTemplateEditorSlotCategories(slot),
    position: [slot.position.x, slot.position.y, slot.position.z],
    rotationY: slot.rotationY,
    initialModel: slot.initialModel ? { ...slot.initialModel } : null,
    markerSize: typeof slot.markerSize === 'number' ? slot.markerSize : Number(slot.markerSize) || 1,
    targetSize: typeof slot.targetSize === 'number' ? slot.targetSize : Number(slot.targetSize) || Number(slot.modelScale) || Number(slot.markerSize) || 1,
    modelScale: typeof slot.modelScale === 'number' ? slot.modelScale : Number(slot.modelScale) || Number(slot.targetSize) || Number(slot.markerSize) || 1
  }))
}

function saveTemplateToLocalStorage() {
  if (!canEditTemplate.value) return
  try {
    localStorage.setItem(ROOM_TEMPLATE_STORAGE_KEY, JSON.stringify(getTemplateSnapshot()))
    templateEditorMessage.value = 'Template lokaal opgeslagen.'
  } catch {
    templateEditorMessage.value = 'Opslaan mislukt (localStorage niet beschikbaar).'
  }
}

function getDeletedTemplateSlotsSet() {
  try {
    const raw = localStorage.getItem(ROOM_TEMPLATE_DELETED_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.map((id) => String(id || '').trim()).filter(Boolean))
  } catch {
    return new Set()
  }
}

function addDeletedTemplateSlot(slotId) {
  if (!slotId) return
  try {
    const set = getDeletedTemplateSlotsSet()
    set.add(String(slotId))
    localStorage.setItem(ROOM_TEMPLATE_DELETED_KEY, JSON.stringify(Array.from(set)))
  } catch {
    // ignore
  }
}

function filterDeletedTemplateSlots(slots = []) {
  const deletedSlots = getDeletedTemplateSlotsSet()
  if (!deletedSlots.size) return Array.isArray(slots) ? [...slots] : []
  return Array.isArray(slots)
    ? slots.filter((slot) => !deletedSlots.has(String(slot?.id || '').trim()))
    : []
}

function restoreTemplateFromBase() {
  TEMPLATE_SLOTS.value = filterDeletedTemplateSlots(cloneTemplateSlots(BASE_TEMPLATE_SLOTS))
}

function resetTemplateDefaults() {
  if (!canEditTemplate.value) return
  try {
    localStorage.removeItem(ROOM_TEMPLATE_STORAGE_KEY)
    localStorage.removeItem(ROOM_TEMPLATE_DELETED_KEY)
  } catch {
    // ignore
  }

  restoreTemplateFromBase()
  rebuildTemplateSlotScene({ hydrateCurated: true })
  writeDraftFromSlot()
  templateEditorMessage.value = 'Template hersteld naar standaard.'
  emit('scene-mutated')
}

function applyStoredTemplateIfAny() {
  if (!canEditTemplate.value) return
  let parsed = null
  try {
    const raw = localStorage.getItem(ROOM_TEMPLATE_STORAGE_KEY)
    parsed = raw ? JSON.parse(raw) : null
  } catch {
    parsed = null
  }

  if (!Array.isArray(parsed) || parsed.length === 0) return

  TEMPLATE_SLOTS.value = filterDeletedTemplateSlots(normalizeTemplateSlots(parsed))
}

function toColorHex(value, fallback) {
  const input = String(value || '').trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(input)) return input
  return fallback
}

function getBrandWallHex() {
  try {
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      const cssVal = getComputedStyle(document.documentElement).getPropertyValue('--brand-light') || ''
      const cleaned = String(cssVal || '').trim()
      if (/^#[0-9a-f]{6}$/.test(cleaned)) return cleaned
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_WALL_COLOR
}

function applyRoomColors({
  floorTextureId: incomingFloorTextureId,
  wallTextureId: incomingWallTextureId,
  floorTextureColorsById: incomingFloorTextureColorsById,
  wallTextureColorsById: incomingWallTextureColorsById
} = {}) {
  if (incomingFloorTextureColorsById) {
    floorTextureColorsById = normalizeTextureColorMap('floor', incomingFloorTextureColorsById)
  }

  if (incomingWallTextureColorsById) {
    wallTextureColorsById = normalizeTextureColorMap('wall', incomingWallTextureColorsById)
  }

  const nextFloorTextureId = normalizeFloorTextureId(incomingFloorTextureId || floorTextureId)
  const nextWallTextureId = normalizeWallTextureId(incomingWallTextureId || wallTextureId)
  const nextFloorPalette = getTexturePalette('floor', nextFloorTextureId, floorTextureColorsById)
  const nextWallPalette = getTexturePalette('wall', nextWallTextureId, wallTextureColorsById)
  const nextFloorPaletteKey = paletteKey(nextFloorPalette)
  const nextWallPaletteKey = paletteKey(nextWallPalette)

  if (nextFloorTextureId !== floorTextureId || nextFloorPaletteKey !== floorTexturePaletteKey) {
    floorTextureId = nextFloorTextureId
    floorTexturePaletteKey = nextFloorPaletteKey
    floorTexture = createFloorTexture(floorTextureId, nextFloorPalette)
    setMaterialMap(floorMaterial, floorTexture)
  }

  if (nextWallTextureId !== wallTextureId || nextWallPaletteKey !== wallTexturePaletteKey) {
    wallTextureId = nextWallTextureId
    wallTexturePaletteKey = nextWallPaletteKey
    wallTexture = createWallTexture(wallTextureId, nextWallPalette)
    sideWallTexture = wallTexture
    setMaterialMap(wallMaterial, wallTexture)
    setMaterialMap(sideWallMaterial, sideWallTexture)
  }

  return {
    floorTextureId,
    wallTextureId,
    floorTextureColorsById,
    wallTextureColorsById,
    floorColor: nextFloorPalette.primaryColor,
    wallColor: nextWallPalette.primaryColor,
    floorAccentColor: nextFloorPalette.secondaryColor,
    wallAccentColor: nextWallPalette.secondaryColor
  }
}


function createScene() {
  scene = new THREE.Scene()
  // Leave scene.background null so renderer with alpha:true is transparent
  scene.background = null
  scene.fog = null

  camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400)
  camera.up.set(0, 1, 0)
  
  // VR mode: position camera at eye level in center of room
  if (props.vrMode) {
    camera.position.set(0, 12, 0)
    camera.lookAt(0, 12, 1)
  } else {
    camera.position.copy(START_CAMERA)
    camera.lookAt(FIXED_TARGET)
  }

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  // tune exposure for better contrast with page gradient
  renderer.toneMappingExposure = props.vrMode ? 1.2 : 0.92
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.cursor = 'pointer'
  // Ensure canvas background stays transparent so underlying page gradient shows
  renderer.domElement.style.background = 'transparent'

  const el = containerEl.value
  el.appendChild(renderer.domElement)

  orbit = new OrbitControls(camera, renderer.domElement)
  orbit.enableDamping = true
  orbit.enablePan = false
  orbit.enableZoom = !props.vrMode  // Disable zoom in VR mode
  orbit.dampingFactor = 0.08
  orbit.zoomSpeed = 2.2
  
  if (props.vrMode) {
    // VR mode: disable OrbitControls, use custom rotation
    orbit.enabled = false

    // Use pointer events so touch on mobile can also rotate the VR view.
    const onVRPointerDown = (e) => {
      // prevent pointer from triggering selection handlers
      e.stopPropagation()
      vrIsDragging = true
      vrDragStartX = e.clientX
      vrDragStartY = e.clientY
      // capture to keep receiving pointer events
      try { e.target.setPointerCapture?.(e.pointerId) } catch (err) {}
    }

    const onVRPointerMove = (e) => {
      if (!vrIsDragging) return
      const deltaX = e.clientX - vrDragStartX
      const deltaY = e.clientY - vrDragStartY

      vrYaw -= deltaX * 0.01
      vrPitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, vrPitch - deltaY * 0.01))

      vrDragStartX = e.clientX
      vrDragStartY = e.clientY
    }

    const onVRPointerUp = (e) => {
      vrIsDragging = false
      try { e.target.releasePointerCapture?.(e.pointerId) } catch (err) {}
    }

    renderer.domElement.addEventListener('pointerdown', onVRPointerDown)
    renderer.domElement.addEventListener('pointermove', onVRPointerMove)
    renderer.domElement.addEventListener('pointerup', onVRPointerUp)
    renderer.domElement.addEventListener('pointercancel', onVRPointerUp)
    renderer.domElement.addEventListener('pointerleave', onVRPointerUp)
  } else {
    // Normal mode: keep existing settings
    orbit.enableRotate = false
    orbit.minDistance = ZOOM_NEAR_DISTANCE
    orbit.maxDistance = ZOOM_FAR_DISTANCE
    orbit.target.copy(FIXED_TARGET)
    orbit.mouseButtons = {
      LEFT: THREE.MOUSE.NONE,
      MIDDLE: THREE.MOUSE.NONE,
      RIGHT: THREE.MOUSE.NONE
    }
  }
  
  if (!props.vrMode) {
    orbit.screenSpacePanning = false
    orbit.update()
    const dirX = FIXED_TARGET.x - START_CAMERA.x
    const dirZ = FIXED_TARGET.z - START_CAMERA.z
    initialAzimuth = Math.atan2(dirX, dirZ)
    currentLookYaw = initialAzimuth
    syncTargetToCurrentYaw()
  }
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
    if (!e.value && selectedRoot) {
      if (positionEditMode) {
        updateSelectedAnchor()
        return
      }
      syncSlotFromRoot(selectedRoot)
      pushSceneHistorySnapshot()
      emit('scene-mutated')
    }
  })
  transform.addEventListener('objectChange', () => {
    if (!selectedRoot) return
    if (positionEditMode) {
      updateSelectedAnchor()
      return
    }
    syncSlotFromRoot(selectedRoot)
  })
  scene.add(transform)

  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()

  // Lights (required)
  // Softer neutral lighting so the room stays readable without washing out the page gradient
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 1.1)
  hemi.position.set(0, 80, 0)
  scene.add(hemi)

  const dir = new THREE.DirectionalLight(0xffffff, 1.5)
  dir.position.set(30, 40, 10)
  dir.castShadow = true
  dir.shadow.mapSize.set(1024, 1024)
  dir.shadow.bias = -0.0008
  scene.add(dir)

  const fill = new THREE.PointLight(0xffecd5, 0.75, 75, 1.6)
  fill.position.set(-12, 14, 18)
  scene.add(fill)

  const warmLamp = new THREE.PointLight(0xffedd6, 0.55, 55, 1.8)
  warmLamp.position.set(18, 10, -6)
  scene.add(warmLamp)

  const cornerWarm = new THREE.PointLight(0xffe6cb, 0.45, 45, 1.9)
  cornerWarm.position.set(-20, 8, -18)
  scene.add(cornerWarm)

  const accent = new THREE.SpotLight(0xffffff, 0.65, 90, Math.PI / 6, 0.45, 1.2)
  accent.position.set(0, 16, 2)
  accent.target.position.set(0, 2, -10)
  accent.castShadow = true
  scene.add(accent)

  // If we're in VR mode for visitors, boost overall light so scene is brighter on headsets/phones
  if (props.vrMode) {
    const VR_LIGHT_BOOST = 1.6
    try {
      hemi.intensity = (hemi.intensity || 1) * VR_LIGHT_BOOST
      dir.intensity = (dir.intensity || 1) * VR_LIGHT_BOOST
      fill.intensity = (fill.intensity || 1) * VR_LIGHT_BOOST
      warmLamp.intensity = (warmLamp.intensity || 1) * VR_LIGHT_BOOST
      cornerWarm.intensity = (cornerWarm.intensity || 1) * VR_LIGHT_BOOST
      accent.intensity = (accent.intensity || 1) * VR_LIGHT_BOOST
    } catch (e) {
      // ignore if something isn't present
    }
  }

  // watch debug mode to apply visual tests
  watch(debugMode, (val) => {
    if (!renderer || !renderer.domElement) return
    // reset
    renderer.domElement.style.background = 'transparent'
    renderer.setClearColor(0x000000, 0)
    if (scene) {
      scene.background = null
      scene.overrideMaterial = null
    }
    const existingCover = document.getElementById('three-debug-cover')
    if (existingCover) existingCover.remove()

    if (val === 'canvas-red') {
      renderer.setClearColor(0xff0000, 1)
      if (scene) {
        scene.background = new THREE.Color(0xff0000)
        scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
      }
      try {
        if (containerEl?.value) containerEl.value.style.outline = '6px solid rgba(255,0,0,0.9)'
      } catch (e) {}
    }

    if (val === 'cover-red') {
      const cover = document.createElement('div')
      cover.id = 'three-debug-cover'
      cover.style.position = 'fixed'
      cover.style.inset = '0'
      cover.style.zIndex = '2400'
      cover.style.pointerEvents = 'none'
      cover.style.background = 'rgba(255,0,0,0.6)'
      document.body.appendChild(cover)
      try {
        if (containerEl?.value) containerEl.value.style.outline = '6px solid rgba(255,0,0,0.9)'
      } catch (e) {}
    }
  })
  accent.shadow.mapSize.set(1024, 1024)
  accent.shadow.bias = -0.0005
  scene.add(accent.target)

  // Large room surfaces to keep borders out of view while zooming.
  const TILE_BAND_HEIGHT = 0
  const floorGeo = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE)
  floorTexture = createFloorTexture(floorTextureId)
  floorMaterial = createBaseMaterial(floorTexture, 0xffffff)
  const floor = new THREE.Mesh(floorGeo, floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, -0.001, 0)
  floor.receiveShadow = true
  scene.add(floor)

  // Back wall
  wallTexture = createWallTexture(wallTextureId)
  const brandWallHex = getBrandWallHex()
  wallMaterial = createBaseMaterial(wallTexture, brandWallHex)
  wallMaterial.side = THREE.DoubleSide

  sideWallTexture = wallTexture
  sideWallMaterial = createBaseMaterial(sideWallTexture, brandWallHex)
  sideWallMaterial.side = THREE.DoubleSide

  tileMaterial = createBaseMaterial(createTileTexture(), brandWallHex)
  tileMaterial.side = THREE.DoubleSide

  const backWallWallpaper = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, WALL_HEIGHT), wallMaterial)
  backWallWallpaper.position.set(0, WALL_HEIGHT / 2, -ROOM_SIZE / 2)
  backWallWallpaper.receiveShadow = true
  scene.add(backWallWallpaper)

  // Right wall
  const rightWallWallpaper = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, WALL_HEIGHT), sideWallMaterial)
  rightWallWallpaper.rotation.y = -Math.PI / 2
  rightWallWallpaper.position.set(ROOM_SIZE / 2, WALL_HEIGHT / 2, 0)
  rightWallWallpaper.receiveShadow = true
  scene.add(rightWallWallpaper)

  // Left wall and front wall only in VR mode
  if (props.vrMode) {
    const leftWallWallpaper = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, WALL_HEIGHT), sideWallMaterial)
    leftWallWallpaper.rotation.y = Math.PI / 2
    leftWallWallpaper.position.set(-ROOM_SIZE / 2, WALL_HEIGHT / 2, 0)
    leftWallWallpaper.receiveShadow = true
    scene.add(leftWallWallpaper)

    const frontWallWallpaper = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, WALL_HEIGHT), wallMaterial)
    frontWallWallpaper.rotation.y = Math.PI
    frontWallWallpaper.position.set(0, WALL_HEIGHT / 2, ROOM_SIZE / 2)
    frontWallWallpaper.receiveShadow = true
    scene.add(frontWallWallpaper)
  }

  // Add VR floating photos
  if (props.vrMode && props.vrItems && props.vrItems.length > 0) {
    addVRPhotos()
  }

  // Defer furniture hydration until the room data is loaded.
  // This keeps the scene blank while existing rooms/templates are still resolving.
  if (props.vrMode) {
    syncContributionCandles()
  }
  
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

function addVRPhotos() {
  const items = props.vrItems || []
  const count = Math.min(items.length, 12)
  if (count === 0) return

  items.slice(0, 12).forEach((item, index) => {
    if (!item.mediaUrl) return

    const angle = (index / count) * Math.PI * 2
    const elevation = (index % 2) * 1.5 - 0.75
    const radius = 6

    const x = Math.cos(angle) * radius
    const y = 12 + elevation  // Match camera height
    const z = Math.sin(angle) * radius

    const textureLoader = new THREE.TextureLoader()
    textureLoader.load(item.mediaUrl, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace

      const geoPhoto = new THREE.PlaneGeometry(2, 2.7)
      const matPhoto = new THREE.MeshStandardMaterial({
        map: texture,
        metalness: 0.1,
        roughness: 0.5,
        side: THREE.DoubleSide
      })

      const photoMesh = new THREE.Mesh(geoPhoto, matPhoto)
      photoMesh.position.set(x, y, z)
      photoMesh.lookAt(0, y, 0)

      photoMesh.userData = {
        angle,
        baseY: y,
        radius,
        elevation,
        index
      }

      photoMesh.castShadow = true
      photoMesh.receiveShadow = true

      scene.add(photoMesh)
    })
  })
}

function animateVRPhotos() {
  if (!scene) return
  
  const time = Date.now() * 0.0008
  
  scene.traverse((obj) => {
    if (!obj.userData || obj.userData.baseY === undefined) return
    
    const { angle, radius, baseY } = obj.userData
    const delay = obj.userData.index * 0.15
    const float = Math.sin(time + delay) * 0.5
    const sway = Math.cos(time * 0.5 + delay) * 0.3

    const x = Math.cos(angle) * (radius + sway)
    const y = baseY + float
    const z = Math.sin(angle) * (radius + sway)

    obj.position.set(x, y, z)
  })
}

function getContributionCandleItems() {
  const items = Array.isArray(props.roomContributions) ? props.roomContributions : []
  return items
    .filter((item) => item?.type === 'candle' && item?._id)
    .sort((a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime())
}

function clearContributionCandles() {
  while (contributionCandleRoots.length) {
    const root = contributionCandleRoots.pop()
    if (root && scene) {
      scene.remove(root)
    }
  }
}

function getContributionCandlePosition(index, total) {
  const groupCount = Math.max(1, CONTRIBUTION_CANDLE_GROUP_POSITIONS.length)
  const groupIndex = index % groupCount
  const indexInGroup = Math.floor(index / groupCount)
  const anchor = CONTRIBUTION_CANDLE_GROUP_POSITIONS[groupIndex] || new THREE.Vector3(0, FLOOR_Y, 0)
  const columns = 3
  const row = Math.floor(indexInGroup / columns)
  const column = indexInGroup % columns
  const rowShift = row % 2 === 0 ? 0 : 1.1
  const xOffsets = [-2.2, 0, 2.2]
  const zSpacing = 2.0
  const depthOffset = 0.35 + (row * 0.35)

  return new THREE.Vector3(
    anchor.x + xOffsets[column] + rowShift,
    FLOOR_Y,
    anchor.z + (row * zSpacing) + depthOffset
  )
}

function createContributionCandleRoot(item, index, total) {
  const root = new THREE.Group()
  root.userData.isContributionCandle = true
  root.userData.contributionId = String(item?._id || '')
  root.userData.giverName = String(item?.giverName || '').trim()
  root.userData.tributeText = String(item?.tributeText || '').trim()

  const waxMat = new THREE.MeshStandardMaterial({
    color: 0xf6f0dc,
    roughness: 0.85,
    metalness: 0.05
  })
  const wickMat = new THREE.MeshStandardMaterial({
    color: 0x2f2519,
    roughness: 1,
    metalness: 0
  })
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xffb347,
    emissive: 0xff8f1f,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.92,
    roughness: 0.35,
    metalness: 0
  })

  const candleHeight = CONTRIBUTION_CANDLE_HEIGHT + ((index % 3) * 0.08)
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, candleHeight, 20), waxMat)
  wax.position.y = candleHeight / 2
  wax.castShadow = true
  wax.receiveShadow = true
  wax.userData.isContributionCandle = true
  root.add(wax)

  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 8), wickMat)
  wick.position.y = candleHeight + 0.04
  wick.userData.isContributionCandle = true
  root.add(wick)

  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), flameMat)
  flame.scale.set(0.62, 1.2, 0.62)
  flame.position.y = candleHeight + 0.17
  flame.userData.isContributionCandle = true
  root.add(flame)

  const glow = new THREE.PointLight(0xffc978, 0.28, 4.8, 2)
  glow.position.y = candleHeight + 0.16
  glow.userData.isContributionCandleLight = true
  root.add(glow)

  root.userData.flameRef = flame
  root.userData.lightRef = glow
  root.userData.flickerSeed = (index + 1) * 0.67
  root.userData.baseFlameY = flame.position.y

  const position = getContributionCandlePosition(index, total)
  root.position.copy(position)
  root.rotation.y = (Math.PI * 0.2) + (index * 0.33)
  root.scale.setScalar(CONTRIBUTION_CANDLE_SCALE)

  return root
}

function syncContributionCandles() {
  if (!scene || props.vrMode) return

  clearContributionCandles()
  const candleItems = getContributionCandleItems()
  const total = candleItems.length
  if (!total) return

  candleItems.forEach((item, index) => {
    const root = createContributionCandleRoot(item, index, total)
    contributionCandleRoots.push(root)
    scene.add(root)
  })
}

function animateContributionCandles() {
  if (!contributionCandleRoots.length) return

  const t = Date.now() * 0.0032
  for (const root of contributionCandleRoots) {
    const flame = root?.userData?.flameRef
    const light = root?.userData?.lightRef
    const seed = Number(root?.userData?.flickerSeed || 0)
    const baseY = Number(root?.userData?.baseFlameY || 1.3)
    const wave = Math.sin(t + seed)
    const waveFine = Math.sin((t * 1.9) + (seed * 1.7))
    const flicker = (wave * 0.5) + (waveFine * 0.5)

    if (flame) {
      flame.scale.set(0.6 + (flicker * 0.08), 1.14 + (flicker * 0.13), 0.6 + (flicker * 0.08))
      flame.position.y = baseY + (flicker * 0.02)
    }

    if (light) {
      light.intensity = THREE.MathUtils.clamp(
        0.3 + (flicker * 0.16),
        CONTRIBUTION_CANDLE_MIN_FLAME_INTENSITY,
        CONTRIBUTION_CANDLE_MAX_FLAME_INTENSITY
      )
    }
  }
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
    // VR mode: keep camera centered and handle rotation
    if (props.vrMode) {
      // Always keep camera at center
      camera.position.set(0, 12, 0)
      
      // Calculate look direction based on yaw and pitch
      const direction = new THREE.Vector3(
        Math.sin(vrYaw) * Math.cos(vrPitch),
        Math.sin(vrPitch),
        Math.cos(vrYaw) * Math.cos(vrPitch)
      )
      
      // Look in the direction
      camera.lookAt(
        camera.position.x + direction.x * 10,
        camera.position.y + direction.y * 10,
        camera.position.z + direction.z * 10
      )
    } else {
      // Normal mode: existing logic
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
    }

    updateCameraDebug()
    updateSelectedAnchor()
    updateAllSlotAnchors()
    
    // Animate VR photos
    if (props.vrMode) {
      animateVRPhotos()
    } else {
      animateContributionCandles()
    }
    
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

function updateAllSlotAnchors() {
  if (!camera || !renderer) {
    emit('slot-markers', [])
    return
  }

  const anchors = []
  for (const [slotId, slotState] of slotStates.entries()) {
    if (!slotState || !slotState.position) continue

    // Only show marker if slot currently has no root (empty)
    const visible = !slotState.root
    if (!visible) continue

    const center = slotState.position.clone()
    // lift popup above slot a bit
    center.y = (center.y || 0) + 0.9

    const projected = center.project(camera)
    if (projected.z > 1 || projected.z < -1) continue

    const width = renderer.domElement.clientWidth
    const height = renderer.domElement.clientHeight
    const x = ((projected.x + 1) / 2) * width
    const y = ((-projected.y + 1) / 2) * height

    anchors.push({ slotId, x, y })
  }

  emit('slot-markers', anchors)
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
      await loadModelAssetWithFallback({
        url: adaptStaticAssetUrl(curated.url),
        title: curated.title || slot.label || slot.id,
        id: curated.id || slot.id,
        replaceRoot: { slotId: slot.id },
        transform: {
          fixedTargetSize: Number(slot.targetSize) > 0 ? Number(slot.targetSize) : undefined,
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
  root.userData.slotLabel = getTemplateSlotDisplayLabel(slot)
  root.userData.slotAccepts = Array.isArray(slot?.accepts) ? [...slot.accepts] : ['meubel']
  root.userData.id = slot.id
  root.userData.title = getTemplateSlotDisplayLabel(slot) || String(slot.id.replace('slot-', '').replace('-', ' '))

  const makeMaterial = (texture, color, roughness = 0.95, metalness = 0) => new THREE.MeshStandardMaterial({
    map: texture,
    color,
    roughness,
    metalness
  })

  const sofaMaterial = makeMaterial(createFabricTexture(), 0xa7836b, 1.0, 0)
  const tableMaterial = makeMaterial(createWoodFloorTexture(), 0xb07a4c, 0.96, 0)
  const shelfMaterial = makeMaterial(createRattanTexture(), 0xd0b28a, 0.98, 0)
  const tvMaterial = makeMaterial(createSlateTexture(), 0x4f545f, 0.88, 0.04)
  const legMaterial = makeMaterial(createDarkWoodTexture(), 0x7b5a3a, 0.95, 0)

  if (slot.id === 'slot-sofa') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.0, 1.7), sofaMaterial)
    base.position.set(0, 0.5, 0)
    base.castShadow = true
    base.receiveShadow = true
    root.add(base)
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.0, 0.35), sofaMaterial)
    backrest.position.set(0, 1.15, -0.65)
    backrest.castShadow = true
    backrest.receiveShadow = true
    root.add(backrest)
  } else if (slot.id === 'slot-table') {
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.15, 1.2), tableMaterial)
    top.position.set(0, 1.0, 0)
    top.castShadow = true
    top.receiveShadow = true
    root.add(top)
    const legPositions = [[0.9, 0.5, 0.5], [-0.9, 0.5, 0.5], [0.9, 0.5, -0.5], [-0.9, 0.5, -0.5]]
    for (const [x, y, z] of legPositions) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 0.12), legMaterial)
      leg.position.set(x, y, z)
      leg.castShadow = true
      leg.receiveShadow = true
      root.add(leg)
    }
  } else if (slot.id === 'slot-tv') {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 0.6), tvMaterial)
    stand.position.set(0, 0.18, 0)
    stand.castShadow = true
    stand.receiveShadow = true
    root.add(stand)
  } else {
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.8), shelfMaterial)
    cabinet.position.set(0, 1.3, 0)
    cabinet.castShadow = true
    cabinet.receiveShadow = true
    root.add(cabinet)
  }

  // Keep starter furniture aligned with imported-model normalization.
  const effectiveTargetSize = getEffectiveTargetSize({
    slotId: slot?.id,
    title: root.userData.title,
    baseTargetSize: MODEL_SIZE_TARGET
  })
  const fixedTargetSize = Number(slot?.targetSize)
  const appliedTargetSize = Number.isFinite(fixedTargetSize) && fixedTargetSize > 0 ? fixedTargetSize : effectiveTargetSize
  centerAndGround(root, appliedTargetSize)
  root.userData.targetSize = appliedTargetSize

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
  root.userData.slotLabel = getTemplateSlotDisplayLabel(slot)
  root.userData.slotAccepts = Array.isArray(slot?.accepts) ? [...slot.accepts] : ['meubel']
  root.userData.slotCategories = getTemplateEditorSlotCategories(slot)
  root.userData.rotationYOffset = preferredRotationYOffset
  root.userData.id = `marker-${slotId}`
  root.userData.title = `Plaats hier (${root.userData.slotLabel})`

  // background rounded rect using Shape + ExtrudeGeometry
  const bgShape = new THREE.Shape()
  const w = 0.9
  const hrect = 0.9
  const r = 0.12
  bgShape.moveTo(-w / 2 + r, -hrect / 2)
  bgShape.lineTo(w / 2 - r, -hrect / 2)
  bgShape.absarc(w / 2 - r, -hrect / 2 + r, r, -Math.PI / 2, 0, false)
  bgShape.lineTo(w / 2, hrect / 2 - r)
  bgShape.absarc(w / 2 - r, hrect / 2 - r, r, 0, Math.PI / 2, false)
  bgShape.lineTo(-w / 2 + r, hrect / 2)
  bgShape.absarc(-w / 2 + r, hrect / 2 - r, r, Math.PI / 2, Math.PI, false)
  bgShape.lineTo(-w / 2, -hrect / 2 + r)
  bgShape.absarc(-w / 2 + r, -hrect / 2 + r, r, Math.PI, (3 * Math.PI) / 2, false)

  // Only create a small upright plus sign (no background/frame)
  // Use branding light color if available (CSS var `--brand-light`), fallback to dark blue
  let brandColorNum = 0x123a57
  try {
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      const cssVal = (getComputedStyle(document.documentElement).getPropertyValue('--brand-light') || '').trim()
      if (/^#[0-9a-f]{6}$/i.test(cssVal)) {
        brandColorNum = parseInt(cssVal.replace('#', ''), 16)
      }
    }
  } catch (e) {
    // ignore and use fallback
  }
  // Create a small CTA-style marker: colored disc behind a white upright plus
  let brandColorNumLocal = brandColorNum
  if (!brandColorNumLocal) brandColorNumLocal = 0x0b5ea6

  // colored disc (CTA background)
  try {
    const discRadius = 0.28
    const discGeo = new THREE.CircleGeometry(discRadius, 32)
    const discMat = new THREE.MeshStandardMaterial({ color: brandColorNumLocal, roughness: 0.35, metalness: 0.1, emissive: brandColorNumLocal, emissiveIntensity: 0.2 })
    const disc = new THREE.Mesh(discGeo, discMat)
    disc.rotation.x = 0
    disc.position.set(0, 0.45, 0.02)
    root.add(disc)
  } catch (e) {}

  // white plus sign (upright)
  const plusMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.05, emissive: 0xffffff, emissiveIntensity: 0.05 })
  const armLen = 0.34
  const armThickness = 0.08
  const armDepth = 0.04

  const vArm = new THREE.Mesh(new THREE.BoxGeometry(armThickness, armLen, armDepth), plusMat)
  vArm.position.set(0, 0.45, 0.045)
  root.add(vArm)

  const hArm = new THREE.Mesh(new THREE.BoxGeometry(armLen, armThickness, armDepth), plusMat)
  hArm.position.set(0, 0.45, 0.045)
  root.add(hArm)

  // Apply per-slot marker size scaling (default 1)
  try {
    const size = Number(slot?.markerSize) || 1
    // default smaller marker to match design
    const base = 0.78
    const final = base * size
    if (final !== 1) root.scale.set(final, final, final)
  } catch {
    // ignore invalid markerSize
  }

  // Make the slot marker mesh visible so the plus is shown in the editor UI.
  // Visibility of the HTML overlay markers is handled separately by `updateAllSlotAnchors`.
  try {
    root.visible = !!canEditTemplate.value
  } catch {}

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
  // apply saved positionOffset (relative to slot) if present
  const posOff = root.userData?.positionOffset
  if (Array.isArray(posOff) && posOff.length >= 3) {
    const ox = Number(posOff[0] || 0)
    const oy = Number(posOff[1] || 0)
    const oz = Number(posOff[2] || 0)
    root.position.set(slot.position.x + ox, slot.position.y + oy, slot.position.z + oz)
  } else {
    root.position.set(slot.position.x, slot.position.y, slot.position.z)
  }
  root.rotation.set(0, slot.rotationY + Number(root.userData.rotationYOffset || 0), 0)
  const allowVertical = isSmallDecorationSlot(slotId)
  if (!allowVertical) {
    snapRootToFloor(root, FLOOR_Y)
  }
  root.updateMatrixWorld(true)
  if (!allowVertical) {
    snapRootToFloor(root, FLOOR_Y)
  }

  scene.add(root)
  selectableRoots.push(root)
  slot.root = root
  // track applied model scale for relative adjustments
  slot.appliedModelScale = Number(root.userData?.appliedModelScale) || (root.scale ? Number(root.scale.x) || 1 : 1)
  slot.targetSize = Number(root.userData?.targetSize) || slot.targetSize || 0
  try {
    console.log('[assignRootToSlot] assigned root', { slotId, targetSize: root.userData?.targetSize, appliedModelScale: root.userData?.appliedModelScale, scale: root.scale ? root.scale.toArray() : null })
  } catch (e) { /* ignore */ }
  select(root)
}

function removeFurnitureFromSlot(slotId) {
  const slot = slotStates.get(slotId)
  if (!slot || !slot.root) return

  const previousYOffset = Number(slot.root.userData?.rotationYOffset)
  if (Number.isFinite(previousYOffset)) {
    slot.preferredRotationYOffset = previousYOffset
  }

  // Capture the removed root's world position and rotation so the marker
  // can be placed exactly where the furniture stood.
  const prevPos = new THREE.Vector3()
  slot.root.getWorldPosition(prevPos)
  const prevRotY = Number(slot.root.rotation?.y) || 0

  removeRoot(slot.root)
  slot.root = null

  // Ensure the slot marker (plus) remains visible so the user can re-add items,
  // but only create markers for editors (visitors should not see them).
  if (canEditTemplate.value) {
    if (!slot.marker) {
      const marker = createSlotMarker(slotId)
      // place marker at the previous furniture world position
      marker.position.copy(prevPos)
      marker.rotation.set(0, prevRotY, 0)
      scene.add(marker)
      selectableRoots.push(marker)
      slot.marker = marker
    }

    // Select the marker so the plus is visible/active after deleting the furniture.
    select(slot.marker)
  } else {
    // For visitors, clear selection
    deselect()
  }
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
  console.debug('[ThreeScene] deselect() - clearing selectedRoot', selectedRoot?.uuid || null)
  if (positionEditMode) {
    finishPositionEditMode({ commit: false })
  }
  selectedRoot = null
  selectedTemplateTarget.value = null
  if (transform) {
    transform.detach()
    transform.visible = false
    transform.enabled = false
  }
  emit('selected', null)
  emit('selected-anchor', null)
}

function select(root) {
  if (positionEditMode && selectedRoot && selectedRoot !== root) {
    finishPositionEditMode({ commit: false })
  }
  selectedRoot = root
  selectedTemplateTarget.value = root?.userData?.isSlotMarker
    ? null
    : {
        uuid: root?.uuid || '',
        id: root?.userData?.id || '',
        title: root?.userData?.title || '',
        slotId: root?.userData?.slotId || '',
        slotLabel: root?.userData?.slotLabel || ''
      }
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
  console.debug('[ThreeScene] select() ->', info)
  emit('selected', info)
  updateSelectedAnchor()
}

function selectMarkerBySlotId(slotId) {
  const slotState = slotStates.get(slotId)
  const marker = slotState?.marker
  if (marker) {
    select(marker)
    return
  }

  // Virtual slot selection (no 3D marker present)
  if (!slotState || !camera || !renderer) return

  selectedRoot = null
  selectedTemplateTarget.value = {
    uuid: '',
    id: `marker-${slotId}`,
    title: `Plaats hier (${slotState.label || slotId})`,
    slotId,
    slotLabel: slotState.label || slotId
  }

  const info = {
    uuid: '',
    id: `marker-${slotId}`,
    title: `Plaats hier (${slotState.label || slotId})`,
    slotId,
    slotLabel: slotState.label || slotId,
    isSlotMarker: true
  }

  emit('selected', info)

  // compute screen anchor from slot position
  try {
    const center = slotState.position.clone()
    center.y = (center.y || 0) + 0.9
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
  } catch (e) {
    emit('selected-anchor', null)
  }
}

function removeRoot(root) {
  if (!root) return

  const idx = selectableRoots.indexOf(root)
  if (idx >= 0) selectableRoots.splice(idx, 1)

  if (selectedRoot === root) {
    deselect()
  }

  if (root.parent) {
    root.parent.remove(root)
  } else {
    scene.remove(root)
  }
}

function purgeSlotObjects(slotId) {
  const normalizedSlotId = String(slotId || '').trim()
  if (!normalizedSlotId) return

  const rootsToRemove = selectableRoots.filter((root) => String(root?.userData?.slotId || root?.slotId || '') === normalizedSlotId)
  const sceneRootsToRemove = scene
    ? scene.children.filter((child) => String(child?.userData?.slotId || child?.slotId || '') === normalizedSlotId)
    : []

  const uniqueRoots = new Set([...rootsToRemove, ...sceneRootsToRemove])
  for (const root of uniqueRoots) {
    removeRoot(root)
  }

  const slotState = slotStates.get(normalizedSlotId)
  if (slotState) {
    slotState.root = null
    slotState.marker = null
  }
}

function getRootByUuid(uuid) {
  if (!uuid) return null
  return selectableRoots.find((root) => root.uuid === uuid) || null
}

function cloneSceneSnapshot(sceneData) {
  try {
    return JSON.parse(JSON.stringify(sceneData))
  } catch {
    return null
  }
}

function pushSceneHistorySnapshot(sceneData = null) {
  if (isRestoringHistory) return

  const snapshot = cloneSceneSnapshot(sceneData || serializeRoom())
  if (!snapshot) return

  const lastSnapshot = sceneHistoryIndex >= 0 ? sceneHistoryStack[sceneHistoryIndex] : null
  if (lastSnapshot && JSON.stringify(lastSnapshot) === JSON.stringify(snapshot)) {
    return
  }

  if (sceneHistoryIndex < sceneHistoryStack.length - 1) {
    sceneHistoryStack.splice(sceneHistoryIndex + 1)
  }

  sceneHistoryStack.push(snapshot)
  sceneHistoryIndex = sceneHistoryStack.length - 1
}

async function restoreSceneHistory(direction) {
  if (!sceneHistoryStack.length) return false

  const nextIndex = direction === 'undo'
    ? sceneHistoryIndex - 1
    : sceneHistoryIndex + 1

  if (nextIndex < 0 || nextIndex >= sceneHistoryStack.length) return false

  const snapshot = cloneSceneSnapshot(sceneHistoryStack[nextIndex])
  if (!snapshot) return false

  isRestoringHistory = true
  try {
    sceneHistoryIndex = nextIndex
    await loadRoom(snapshot)
    return true
  } finally {
    isRestoringHistory = false
  }
}

function animateRotation(target, deltaRad, duration = 300) {
  return new Promise((resolve) => {
    if (!target) return resolve()
    const start = performance.now()
    const initial = target.rotation.y
    const end = initial + deltaRad

    // add a temporary box helper as highlight (safer than mutating shared materials)
    let boxHelper = null
    try {
      boxHelper = new THREE.BoxHelper(target, 0xffff66)
      scene.add(boxHelper)
    } catch (e) {
      boxHelper = null
    }

    // rotate around object's world center
    const box = new THREE.Box3().setFromObject(target)
    const center = new THREE.Vector3()
    box.getCenter(center)
    const axis = new THREE.Vector3(0, 1, 0)
    let prevAngle = 0

    function tick(now) {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) * (1 - t)
      const angle = (end - initial) * eased
      const delta = angle - prevAngle
      prevAngle = angle

      // move position around center
      try {
        target.position.sub(center)
        target.position.applyAxisAngle(axis, delta)
        target.position.add(center)
        // rotate orientation around world axis
        target.rotateOnWorldAxis(axis, delta)
      } catch (e) {
        // fallback: apply local rotation
        target.rotation.y = initial + angle
      }

      target.updateMatrixWorld(true)

      if (t < 1) {
        requestAnimationFrame(tick)
      } else {
        // remove box helper highlight
        try {
          if (boxHelper) scene.remove(boxHelper)
        } catch (e) {
          /* ignore */
        }

        // Persist rotation offset to userData so scene hydration doesn't overwrite it
        try {
          const slotId = String(target.userData?.slotId || '')
          const prevYOffset = Number(target.userData?.rotationYOffset || 0)
          const added = end - initial
          const newYOffset = prevYOffset + added
          target.userData.rotationYOffset = newYOffset

          if (slotId && slotStates.has(slotId)) {
            const slot = slotStates.get(slotId)
            slot.preferredRotationYOffset = newYOffset
            // also update slot.root userData if present
            if (slot.root) slot.root.userData = slot.root.userData || {}
            if (slot.root) slot.root.userData.rotationYOffset = newYOffset
            // apply consolidated rotation
            try {
              slot.root.rotation.set(0, (slot.rotationY || 0) + Number(slot.root.userData.rotationYOffset || 0), 0)
            } catch (e) {
              /* ignore */
            }
          }
        } catch (e) {
          /* ignore persistence errors */
        }

        resolve()
      }
    }

    requestAnimationFrame(tick)
  })
}

function serializeRoom() {
  syncSlotTargetSizesFromScene()
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

    // persist position as an offset relative to the slot position so small drags are preserved
    let positionOffset = null
    if (slot) {
      const dx = root.position.x - slot.position.x
      const dy = root.position.y - slot.position.y
      const dz = root.position.z - slot.position.z
      positionOffset = [dx, dy, dz]
    } else {
      positionOffset = root.position.toArray()
    }

    furniture.push({
      slotId,
      title: root.userData?.title || '',
      url: root.userData?.url || null,
      positionOffset,
      rotationY: root.rotation.y,
      rotationYOffset: Number(root.userData?.rotationYOffset || 0),
      scale: root.scale.toArray(),
      sizeMultiplier: Number(root.userData?.sizeMultiplier || 1),
      targetSize: Number(root.userData?.targetSize || slot?.targetSize || 0),
      appliedModelScale: Number(root.userData?.appliedModelScale || (root.scale ? Number(root.scale.x) || 1 : 1)),
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
      floorTextureId,
      wallTextureId,
      floorTextureColorsById,
      wallTextureColorsById
    }),
    camera: {
      position: camera?.position?.toArray?.() || null,
      target: orbit?.target?.toArray?.() || null
    }
  }

  return _debugSerialize(result)
}

// Debug helper: log serialize payload
function _debugSerialize(result) {
  try {
    console.log('[serializeRoom] furniture count:', Array.isArray(result.furniture) ? result.furniture.length : 0)
    console.log('[serializeRoom] furniture sample:', (result.furniture || []).map(f => ({ slotId: f.slotId, targetSize: f.targetSize, scale: f.scale, appliedModelScale: f.appliedModelScale })))
  } catch (e) {
    /* ignore */
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
    return
  }

  // Reset scene to default state first
  resetSceneToDefault({ hydrateCurated: false })
  applyRoomColors(sceneData.appearance || {})
  syncTemplateSurfaceEditorFromScene()

  // Load saved furniture
  for (const item of sceneData.furniture) {
    try {
      console.log('[loadRoom] furniture item:', { slotId: item.slotId, url: item.url, targetSize: item.targetSize, isEmpty: item.isEmpty })
    } catch (e) { /* ignore */ }
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
        // compute positionOffset to pass to loader (supporting old saved `position` as fallback)
        const savedOffset = item.positionOffset || null
        let positionOffset = null
        if (Array.isArray(savedOffset) && savedOffset.length >= 3) {
          positionOffset = savedOffset.map((v) => Number(v) || 0)
        } else if (Array.isArray(item.position) && item.position.length >= 3 && slot) {
          positionOffset = [
            Number(item.position[0] || 0) - slot.position.x,
            Number(item.position[1] || 0) - slot.position.y,
            Number(item.position[2] || 0) - slot.position.z
          ]
        }

        await loadModelAssetWithFallback({
          url: adaptStaticAssetUrl(item.url),
          title: item.title || 'Loaded model',
          id: item.id || `loaded-${Date.now()}`,
          replaceRoot: { slotId },
          transform: {
            fixedTargetSize: Number(item.targetSize) > 0 ? Number(item.targetSize) : undefined,
            sizeMultiplier: Number(item.sizeMultiplier) || 1,
            rotationYOffset: Number(item.rotationYOffset || 0),
            positionOffset
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
      const savedTargetSize = Number(item.targetSize)
      if (Number.isFinite(savedTargetSize) && savedTargetSize > 0) {
        defaultRoot.userData = defaultRoot.userData || {}
        centerAndGround(defaultRoot, savedTargetSize)
        defaultRoot.userData.targetSize = savedTargetSize
        defaultRoot.userData.appliedModelScale = 1
      }
      if (Array.isArray(item.position) && item.position.length >= 3) {
        defaultRoot.position.set(Number(item.position[0]) || 0, FLOOR_Y, Number(item.position[2]) || 0)
      }
      // Prefer rotationYOffset if provided (persisted offset), otherwise fall back to rotationY
      if (item.rotationYOffset !== undefined) {
        defaultRoot.userData = defaultRoot.userData || {}
        defaultRoot.userData.rotationYOffset = Number(item.rotationYOffset || 0)
      } else if (item.rotationY !== undefined) {
        // convert absolute rotationY to offset relative to slot.rotationY
        const slotRot = Number(slot.rotationY || 0)
        const offset = Number(item.rotationY) - slotRot
        defaultRoot.userData = defaultRoot.userData || {}
        defaultRoot.userData.rotationYOffset = offset
      }
      snapRootToFloor(defaultRoot, FLOOR_Y)
      assignRootToSlot(defaultRoot, slotId)

      if (Number.isFinite(savedTargetSize) && savedTargetSize > 0) {
        const slotState = slotStates.get(slotId)
        if (slotState?.root) {
          slotState.targetSize = savedTargetSize
          slotState.root.userData = slotState.root.userData || {}
          slotState.root.userData.targetSize = savedTargetSize
        }
      }
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

  if (!isRestoringHistory) {
    pushSceneHistorySnapshot(sceneData)
  }
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
  applyRoomColors({
    floorTextureId: DEFAULT_FLOOR_TEXTURE_ID,
    wallTextureId: DEFAULT_WALL_TEXTURE_ID,
    floorTextureColorsById: {},
    wallTextureColorsById: {}
  })
  syncTemplateSurfaceEditorFromScene()
}

defineExpose({
  serializeRoom,
  loadRoom,
  deleteTemplateSlot,
  selectMarkerBySlotId,
  updateTemplateEditorSlotId: (slotId) => {
    templateEditorSlotId.value = String(slotId || '')
  },
  setTemplateSlotCategory: (category) => {
    const next = String(category || 'Alle')
    templateSlotCategory.value = next
    try {
      // also update the draft's slotCategories so the UI changes are immediately editable
      if (!templateDraft.value || typeof templateDraft.value !== 'object') templateDraft.value = {}
      templateDraft.value.slotCategories = next === 'Alle' ? [] : [next]
    } catch (err) {
      // ignore
    }
  },
  updateTemplateDraftField: (field, value) => {
    if (templateDraft.value && Object.prototype.hasOwnProperty.call(templateDraft.value, field)) {
      templateDraft.value[field] = value

      if (field === 'markerSize' || field === 'modelScale') {
        const nextSize = Number(value)
        const normalizedSize = Number.isFinite(nextSize) && nextSize > 0 ? nextSize : 1
        templateDraft.value.markerSize = normalizedSize
        templateDraft.value.modelScale = normalizedSize
      }

      if (field === 'slotCategories') {
        const nextCategories = normalizeCategoryList(value)
        const slotId = String(templateEditorSlotId.value || '').trim()
        if (slotId && nextCategories.length) {
          syncTemplateSlotCategories(slotId, nextCategories)
        }
      }
    }
  },
  applyTemplateDraft,
  createNewTemplateSlot,
  saveTemplateToLocalStorage,
  resetTemplateDefaults,
  toggleTemplateDrag,
  setTemplateDragMode
  ,
  // Expose reactive template editor state for external panels that use a component ref
  templateEditorSlotId,
  templateSlotCategory,
  templateDraft,
  filteredTemplateSlots,
  templateEditorMessage,
  getTemplateSlotDisplayLabel,
  TEMPLATE_SLOT_EDITOR_CATEGORIES
})

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

  const floorPoint = new THREE.Vector3()
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_Y)
  const floorHit = raycaster.ray.intersectPlane(floorPlane, floorPoint)
  const primaryHit = hits[0]?.point?.clone?.() || null
  const loggedPoint = primaryHit || (floorHit ? floorPoint : null)

  if (loggedPoint) {
    console.info('[ThreeScene] click coordinates', {
      x: Number(loggedPoint.x.toFixed(2)),
      y: Number(loggedPoint.y.toFixed(2)),
      z: Number(loggedPoint.z.toFixed(2)),
      floorX: Number(floorPoint.x.toFixed(2)),
      floorY: Number(FLOOR_Y.toFixed(2)),
      floorZ: Number(floorPoint.z.toFixed(2))
    })
  }

  const firstContributionCandleHit = hits.find((hit) => {
    let current = hit?.object || null
    while (current) {
      if (current?.userData?.isContributionCandle) return true
      current = current.parent
    }
    return false
  })

  if (firstContributionCandleHit) {
    let current = firstContributionCandleHit.object
    while (current && !current?.userData?.contributionId) {
      current = current.parent
    }

    if (current?.userData?.contributionId) {
      emit('contribution-candle-selected', {
        contributionId: String(current.userData.contributionId),
        giverName: String(current.userData.giverName || '').trim(),
        tributeText: String(current.userData.tributeText || '').trim()
      })
      return
    }
  }

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

function isVerticalDecorationSlot(slotId = '') {
  const normalizedSlotId = String(slotId || '').trim()
  if (!normalizedSlotId) return false

  const templateSlot = TEMPLATE_SLOTS.value.find((slot) => slot.id === normalizedSlotId)
  const categories = normalizeCategoryList(templateSlot?.categories || getDefaultTemplateCategories(normalizedSlotId))

  // Allow wall decorations, small decorations, media and computer-related categories to be adjusted in Y.
  const lowerCats = categories.map((c) => String(c || '').toLowerCase())
  const verticalCategoryKeywords = ['muurdecoratie', 'decoratie klein', 'media', 'computer', 'desktop', 'monitor', 'laptop']
  if (lowerCats.some((category) => verticalCategoryKeywords.includes(category))) return true

  // Fallback: treat slots with obvious ids as vertical (e.g. 'tv', 'computer')
  const idLower = normalizedSlotId.toLowerCase()
  if (idLower.includes('tv') || idLower.includes('computer') || idLower.includes('monitor') || idLower.includes('screen')) return true

  return false
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

function buildDirectStaticUrl(url) {
  if (!url) return ''
  const normalized = String(url)
  if (normalized.startsWith('https://static.poly.pizza')) {
    return normalized
  }
  if (normalized.startsWith('/api/poly-static/')) {
    return `https://static.poly.pizza${normalized.slice('/api/poly-static'.length)}`
  }
  if (normalized.startsWith('/poly-static/')) {
    return `https://static.poly.pizza${normalized.slice('/poly-static'.length)}`
  }
  return normalized
}

async function loadModelAssetWithFallback({ url, title, id, replaceRoot = null, transform = {} }) {
  const primaryUrl = adaptStaticAssetUrl(url)

  try {
    return await loadModelAsset({
      url: primaryUrl,
      title,
      id,
      replaceRoot,
      transform
    })
  } catch (error) {
    const status = Number(error?.status || error?.response?.status || error?.cause?.status)
    const directUrl = buildDirectStaticUrl(url)
    const shouldRetry = directUrl && directUrl !== primaryUrl && (status === 403 || /403/.test(String(error?.message || '')))

    if (!shouldRetry) {
      throw error
    }

    if (import.meta.env.DEV) {
      console.warn(`Primary static URL failed for ${title || id || 'model'}; retrying direct static host.`)
    }
    return loadModelAsset({
      url: directUrl,
      title,
      id,
      replaceRoot,
      transform
    })
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

          const targetSlotId = replaceRoot?.userData?.slotId || replaceRoot?.slotId || templateEditorSlotId.value || TEMPLATE_SLOTS.value[0]?.id || ''
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
              c.castShadow = true
              c.receiveShadow = true
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
          const explicitTargetSize = Number(transform?.fixedTargetSize)
          const hasExplicitTargetSize = Number.isFinite(explicitTargetSize) && explicitTargetSize > 0
          const sizeMultiplier = Number(transform?.sizeMultiplier)
          const shouldUseUniformSize = isSmallDecorationSlot(targetSlotId)
            || isTableModel({ title, modelCategory: transform?.modelCategory })
          const targetSize = hasExplicitTargetSize
            ? explicitTargetSize
            : effectiveTargetSize
          const normalizedSize = shouldUseUniformSize
            ? targetSize
            : hasExplicitTargetSize
              ? targetSize
              : Number.isFinite(sizeMultiplier) && sizeMultiplier > 0
              ? targetSize * sizeMultiplier
              : targetSize
          centerAndGround(holder, normalizedSize)
          try {
            console.log('[loadModelAsset] holder normalized:', { slotId: targetSlotId, targetSize: holder.userData.targetSize, sizeMultiplier: holder.userData.sizeMultiplier, appliedModelScale: holder.userData.appliedModelScale, scale: holder.scale ? holder.scale.toArray() : null })
          } catch (e) { /* ignore */ }
          holder.userData.sizeMultiplier = shouldUseUniformSize || hasExplicitTargetSize
            ? 1
            : Number.isFinite(sizeMultiplier) && sizeMultiplier > 0
              ? sizeMultiplier
              : 1
          holder.userData.targetSize = targetSize

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
          // record applied model scale (accept either scaleMultiplier or sizeMultiplier)
          holder.userData.appliedModelScale = hasExplicitTargetSize
            ? 1
            : Number(transform?.scaleMultiplier) || Number(transform?.sizeMultiplier) || 1

          if (!ENFORCE_UNIFORM_MODEL_SIZE && Number.isFinite(transform?.yOffset)) {
            holder.position.y += transform.yOffset
          }

          // apply saved positionOffset if provided
          if (Array.isArray(transform?.positionOffset) && transform.positionOffset.length >= 3) {
            holder.userData.positionOffset = transform.positionOffset.map((v) => Number(v) || 0)
          }
          // record applied model scale before assigning
          if (!holder.userData.appliedModelScale) holder.userData.appliedModelScale = Number(transform?.scaleMultiplier) || 1
          assignRootToSlot(holder, targetSlotId)
          // don't force-snap small decorations to the floor so saved Y offsets are preserved
          if (!isVerticalDecorationSlot(targetSlotId)) {
            snapRootToFloor(holder, FLOOR_Y)
          }

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

      const resolvedSlotId = String(
        replaceRoot?.userData?.slotId ||
        replaceRoot?.slotId ||
        targetSlotId ||
        ''
      ).trim()
      const slotState = resolvedSlotId && slotStates.has(resolvedSlotId)
        ? slotStates.get(resolvedSlotId)
        : null
      const explicitFixedTargetSize = Number(req.fixedTargetSize)
      const slotTargetSize = Number(slotState?.targetSize || 0)
      const currentTargetSize = Number(replaceRoot?.userData?.targetSize || 0)
      const fixedTargetSize = Number.isFinite(explicitFixedTargetSize) && explicitFixedTargetSize > 0
        ? explicitFixedTargetSize
        : Number.isFinite(slotTargetSize) && slotTargetSize > 0
          ? slotTargetSize
          : Number.isFinite(currentTargetSize) && currentTargetSize > 0
            ? currentTargetSize
            : undefined

      const explicitRotationYOffset = Number(req.rotationYOffset)
      const inheritedRotationYOffset = Number(replaceRoot?.userData?.rotationYOffset)
      let rotationYOffset = Number.isFinite(explicitRotationYOffset)
        ? explicitRotationYOffset
        : Number.isFinite(inheritedRotationYOffset)
          ? inheritedRotationYOffset
          : undefined
      if (
        !Number.isFinite(rotationYOffset) &&
        replaceRoot &&
        !replaceRoot?.userData?.isSlotMarker &&
        slotState?.position?.isVector3
      ) {
        const slotRotationY = Number(slotState.rotationY || 0)
        const currentRotationY = Number(replaceRoot.rotation?.y)
        if (Number.isFinite(currentRotationY)) {
          rotationYOffset = currentRotationY - slotRotationY
        }
      }

      let positionOffset = null
      const explicitPositionOffset = Array.isArray(req.positionOffset) && req.positionOffset.length >= 3
        ? req.positionOffset
        : null
      if (explicitPositionOffset) {
        positionOffset = explicitPositionOffset.map((v) => Number(v) || 0)
      } else if (Array.isArray(replaceRoot?.userData?.positionOffset) && replaceRoot.userData.positionOffset.length >= 3) {
        positionOffset = replaceRoot.userData.positionOffset.map((v) => Number(v) || 0)
      } else if (
        replaceRoot &&
        !replaceRoot?.userData?.isSlotMarker &&
        slotState?.position?.isVector3 &&
        replaceRoot?.position?.isVector3
      ) {
        positionOffset = [
          Number(replaceRoot.position.x - slotState.position.x) || 0,
          Number(replaceRoot.position.y - slotState.position.y) || 0,
          Number(replaceRoot.position.z - slotState.position.z) || 0
        ]
      }

      await loadModelAssetWithFallback({
        url: adaptStaticAssetUrl(assetUrl),
        title,
        id,
        replaceRoot,
        transform: {
          fixedTargetSize,
          positionOffset,
          rotationYOffset,
          sizeMultiplier: Number(req.sizeMultiplier) || 1,
          modelCategory: req.modelCategory || ''
        }
      })

      if (!isRestoringHistory) {
        pushSceneHistorySnapshot()
      }
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
    console.debug('[ThreeScene] received sceneCommand ->', command)
    if (!command || !command.type) return
    if (command.type === 'start-position-edit') {
      beginPositionEditMode()
      return
    }
    if (command.type === 'confirm-position-edit') {
      finishPositionEditMode({ commit: true })
      return
    }
    if (command.type === 'cancel-position-edit') {
      finishPositionEditMode({ commit: false })
      return
    }
    if (command.type === 'undo' || command.type === 'redo') {
      restoreSceneHistory(command.type)
      return
    }
    if (command.type === 'delete-selected' && selectedRoot && !selectedRoot.userData?.isSlotMarker) {
      const slotId = selectedRoot.userData?.slotId || ''
      if (slotId) {
        removeFurnitureFromSlot(slotId)
        if (!isRestoringHistory) {
          pushSceneHistorySnapshot()
        }
        emit('scene-mutated')
      }
      return
    }

    if (command.type === 'rotate-selected') {
      const angleDeg = Number(command.angle) || 90
      const angleRad = (angleDeg * Math.PI) / 180
      let target = selectedRoot
      if (!target && command.targetUuid) {
        target = getRootByUuid(command.targetUuid)
      }
      // fallback: try matching by userData.id or title if uuid lookup failed
      if (!target && command.targetId) {
        target = selectableRoots.find((r) => r.userData && String(r.userData.id || r.userData.ID || '') === String(command.targetId)) || null
        console.debug('[ThreeScene] fallback lookup by targetId ->', target?.uuid || null)
      }
      if (!target && command.targetTitle) {
        const titleLower = String(command.targetTitle || '').toLowerCase()
        target = selectableRoots.find((r) => {
          const t = String(r.userData?.title || r.userData?.name || r.name || '').toLowerCase()
          return t && t.includes(titleLower)
        }) || null
        console.debug('[ThreeScene] fallback lookup by targetTitle ->', target?.uuid || null)
      }
      console.debug('[ThreeScene] rotate-selected target ->', target?.uuid || null)
      if (target && !target.userData?.isSlotMarker) {
        // animate rotation for clearer visual feedback
        animateRotation(target, angleRad, 300).then(() => {
          if (!isRestoringHistory) {
            pushSceneHistorySnapshot()
          }
          console.debug('[ThreeScene] rotated target', target?.uuid, 'by', angleDeg)
          // Non-blocking feedback only (no modal alert) so editor rotations don't interrupt workflow.
          templateEditorMessage.value = `Gedraaid: ${angleDeg}°`
          setTimeout(() => { templateEditorMessage.value = '' }, 1800)
        })
        return
      }
      console.debug('[ThreeScene] rotate-selected: no valid target found')
      console.debug('[ThreeScene] rotate-selected: no valid target found')
    }

    if (command.type === 'apply-room-colors') {
      applyRoomColors({
        floorTextureId: command.floorTextureId,
        wallTextureId: command.wallTextureId,
        floorTextureColorsById: command.floorTextureColorsById,
        wallTextureColorsById: command.wallTextureColorsById
      })
      syncTemplateSurfaceEditorFromScene()
      if (!isRestoringHistory) {
        pushSceneHistorySnapshot()
      }
    }
  }
)

watch(
  [() => props.roomContributions, () => props.vrMode, sceneReady],
  ([, vrMode, ready]) => {
    if (!ready || vrMode) {
      clearContributionCandles()
      return
    }
    syncContributionCandles()
  },
  { immediate: true, deep: true }
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
  } else {
    loadTemplateReplacementModels()
    syncTemplateSurfaceEditorFromScene()
  }
  updateTemplateDragBinding()
})

watch(templateDragEnabled, () => {
  updateTemplateDragBinding()
})

watch(templateDragMode, () => {
  updateTemplateDragBinding()
})

onMounted(async () => {
  if (canEditTemplate.value && props.useStoredTemplate) {
    applyStoredTemplateIfAny()
  } else {
    restoreTemplateFromBase()
  }
  createScene()
  // If a recent saved snapshot exists in localStorage (from a save just before reload), use it
  try {
    const rawPending = localStorage.getItem('noek.pendingSavedScene') || localStorage.getItem('noek.lastSavedScene')
    if (rawPending) {
      const parsed = JSON.parse(rawPending)
      const age = Date.now() - (Number(parsed?.ts) || 0)
      // only accept snapshots younger than 30s
      if (age >= 0 && age < 30000 && parsed.sceneData) {
        console.log('[ThreeScene] applying localStorage snapshot (age ms):', age)
        // hydrate immediately to reflect saved visuals
        await loadRoom(parsed.sceneData)
        try {
          localStorage.removeItem('noek.pendingSavedScene')
          localStorage.removeItem('noek.lastSavedScene')
        } catch (e) { /* ignore */ }
      }
    }
  } catch (e) {
    /* ignore localStorage parse errors */
  }
  syncTemplateSurfaceEditorFromScene()
  writeDraftFromSlot(templateEditorSlotId.value)
  loadTemplateReplacementModels()
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
  clearContributionCandles()
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
  <div class="three-scene-shell">
    <div ref="containerEl" class="three-scene-canvas"></div>

    <div v-if="canEditTemplate && adminMode" class="template-editor-overlay admin-visible">
      <button type="button" class="template-editor-toggle" @click="templateEditorOpen = !templateEditorOpen">
        {{ templateEditorOpen ? 'Sluit template editor' : 'Open template editor' }}
      </button>

      <div v-show="templateEditorOpen" class="template-editor-panel">
        <div class="template-editor-head">
          <div>
            <strong>Template editor</strong>
            <p>Werk in 3 stappen: kies een slot, pas snel de positie aan en vervang daarna het object als dat nodig is.</p>
          </div>
          <button type="button" class="template-editor-mini-btn template-editor-mini-btn-primary" @click="saveTemplateToLocalStorage">Opslaan</button>
        </div>

        <div v-if="templateEditorMessage" class="template-editor-message">{{ templateEditorMessage }}</div>
        <div v-if="templateReplacementError" class="template-editor-message is-error">{{ templateReplacementError }}</div>

        <div class="template-editor-grid">
          <section class="template-editor-section">
            <div class="template-section-title-row">
              <h4>1. Slot kiezen</h4>
              <span class="template-editor-help">{{ filteredTemplateSlots.length }} zichtbaar</span>
            </div>
            <div class="template-slot-list">
              <button
                v-for="slot in filteredTemplateSlots"
                :key="slot.id"
                type="button"
                class="template-slot-btn"
                :class="{ active: templateEditorSlotId === slot.id }"
                @click="templateEditorSlotId = slot.id"
              >
                {{ getTemplateSlotDisplayLabel(slot) }}
              </button>
            </div>
            <div class="template-slot-summary">
              <span class="template-slot-summary-label">Actief slot</span>
              <strong>{{ templateEditorSlotId || 'Geen' }}</strong>
            </div>
            <div class="template-editor-actions">
              <button type="button" class="template-editor-mini-btn" @click="createNewTemplateSlot">Nieuw slot</button>
              <button type="button" class="template-editor-mini-btn template-editor-mini-btn-danger" @click="deleteTemplateSlot()">Verwijder slot</button>
              <button type="button" class="template-editor-mini-btn" @click="resetTemplateDefaults">Reset</button>
            </div>
          </section>

          <section class="template-editor-section">
            <div class="template-section-title-row">
              <h4>2. Snel bijstellen</h4>
              <span class="template-editor-help">Direct toepassen op het gekozen slot</span>
            </div>

            <div class="template-editor-field-grid">
              <label class="template-editor-field">
                <span>Positie X</span>
                <input v-model="templateDraft.x" type="number" step="0.1" />
              </label>
              <label class="template-editor-field">
                <span>Positie Y</span>
                <input v-model="templateDraft.y" type="number" step="0.1" />
              </label>
              <label class="template-editor-field">
                <span>Positie Z</span>
                <input v-model="templateDraft.z" type="number" step="0.1" />
              </label>
              <label class="template-editor-field">
                <span>Rotatie</span>
                <input v-model="templateDraft.rotationDeg" type="number" step="0.1" />
              </label>
              <label class="template-editor-field">
                <span>Grootte</span>
                <input v-model="templateDraft.markerSize" type="number" step="0.1" min="0.1" />
              </label>
            </div>

            <div class="template-editor-checks">
              <label><input v-model="templateDraft.acceptsMeubel" type="checkbox" /> Meubel</label>
              <label><input v-model="templateDraft.acceptsPersoonlijk" type="checkbox" /> Persoonlijk</label>
              <label><input v-model="templateDraft.acceptsDecoratie" type="checkbox" /> Decoratie</label>
            </div>

            <div class="template-editor-actions template-editor-actions-wrap">
              <button type="button" class="template-editor-mini-btn template-editor-mini-btn-primary" @click="applyTemplateDraft">Toepassen</button>
              <button type="button" class="template-editor-mini-btn" @click="toggleTemplateDrag">
                {{ templateDragEnabled ? 'Drag uit' : 'Drag aan' }}
              </button>
            </div>

            <details class="template-editor-details">
              <summary>Geavanceerd</summary>
              <div class="template-editor-details-body">
                <label class="template-editor-field">
                  <span>Categorie</span>
                  <select v-model="templateDraft.slotCategories">
                    <option v-for="category in TEMPLATE_SLOT_EDITOR_CATEGORIES" :key="category" :value="category">{{ category }}</option>
                  </select>
                </label>

                <div class="template-editor-actions">
                  <button type="button" class="template-editor-mini-btn" @click="setTemplateDragMode('translate')">Verplaats</button>
                  <button type="button" class="template-editor-mini-btn" @click="setTemplateDragMode('rotate')">Roteer</button>
                </div>
              </div>
            </details>
          </section>

          <section class="template-editor-section template-editor-section-wide">
            <div class="template-section-title-row">
              <h4>3. Vloer en muren</h4>
              <span class="template-editor-help">Kies textuur en kleur voor beide oppervlakken</span>
            </div>

            <div class="template-surface-grid">
              <div class="template-surface-card">
                <div class="template-surface-head">
                  <strong>Vloer</strong>
                  <span>{{ templateFloorTextureId }}</span>
                </div>

                <div class="template-surface-preset-grid">
                  <button
                    v-for="preset in FLOOR_TEXTURE_PRESETS"
                    :key="preset.id"
                    type="button"
                    class="template-surface-preset-btn"
                    :class="{ active: templateFloorTextureId === preset.id }"
                    :style="{ backgroundImage: preset.preview }"
                    @click="applyTemplateSurfaceTexture('floor', preset.id)"
                  >
                    <span>{{ preset.label }}</span>
                  </button>
                </div>

                <div class="template-surface-color-grid">
                  <label class="template-editor-field">
                    <span>Hoofdkleur</span>
                    <input :value="templateFloorPrimaryColor" type="color" @input="updateTemplateSurfaceColor('floor', 'primaryColor', $event.target.value)" />
                  </label>
                  <label class="template-editor-field">
                    <span>Accentkleur</span>
                    <input :value="templateFloorSecondaryColor" type="color" @input="updateTemplateSurfaceColor('floor', 'secondaryColor', $event.target.value)" />
                  </label>
                </div>

                <div class="template-editor-actions">
                  <button type="button" class="template-editor-mini-btn" @click="applyTemplateSurfaceTexture('floor', DEFAULT_FLOOR_TEXTURE_ID)">Reset vloer</button>
                </div>
              </div>

              <div class="template-surface-card">
                <div class="template-surface-head">
                  <strong>Muur</strong>
                  <span>{{ templateWallTextureId }}</span>
                </div>

                <div class="template-surface-preset-grid">
                  <button
                    v-for="preset in WALL_TEXTURE_PRESETS"
                    :key="preset.id"
                    type="button"
                    class="template-surface-preset-btn"
                    :class="{ active: templateWallTextureId === preset.id }"
                    :style="{ backgroundImage: preset.preview }"
                    @click="applyTemplateSurfaceTexture('wall', preset.id)"
                  >
                    <span>{{ preset.label }}</span>
                  </button>
                </div>

                <div class="template-surface-color-grid">
                  <label class="template-editor-field">
                    <span>Hoofdkleur</span>
                    <input :value="templateWallPrimaryColor" type="color" @input="updateTemplateSurfaceColor('wall', 'primaryColor', $event.target.value)" />
                  </label>
                  <label class="template-editor-field">
                    <span>Accentkleur</span>
                    <input :value="templateWallSecondaryColor" type="color" @input="updateTemplateSurfaceColor('wall', 'secondaryColor', $event.target.value)" />
                  </label>
                </div>

                <div class="template-editor-actions">
                  <button type="button" class="template-editor-mini-btn" @click="applyTemplateSurfaceTexture('wall', DEFAULT_WALL_TEXTURE_ID)">Reset muur</button>
                </div>
              </div>
            </div>
          </section>

          <section class="template-editor-section template-editor-section-wide">
            <div class="template-section-title-row">
              <h4>4. Object vervangen</h4>
              <span class="template-editor-help">Zoek op naam, id of categorie</span>
            </div>
            <label class="template-editor-field">
              <span>Zoeken</span>
              <input v-model="templateReplacementSearch" type="text" placeholder="zoek model..." />
            </label>

            <div v-if="templateReplacementLoading" class="template-editor-message">Modellen laden...</div>

            <div v-else class="template-replacement-list">
              <button
                v-for="model in filteredReplacementModels"
                :key="model.id || model.title"
                type="button"
                class="template-replacement-card"
                @click="replaceSelectedTemplateObject(model)"
              >
                <img v-if="getTemplateReplacementPreview(model)" :src="getTemplateReplacementPreview(model)" alt="preview" class="template-replacement-thumb" />
                <span class="template-replacement-label">{{ model.title || model.id || 'Onbekend model' }}</span>
              </button>
            </div>

            <p class="template-tip">Tip: selecteer eerst een slot in de scène. Daarna kun je met een klik een vervangobject kiezen.</p>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.three-scene-shell {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100%;
}

.three-scene-canvas {
  width: 100%;
  height: 100%;
  min-height: 100%;
}

.template-editor-overlay {
  position: absolute;
  right: 16px;
  top: 16px;
  z-index: 20;
  width: min(420px, calc(100% - 32px));
  display: none;
  gap: 10px;
  pointer-events: none;
}

.template-editor-overlay.admin-visible {
  display: grid;
}

.template-editor-toggle,
.template-editor-panel,
.template-editor-mini-btn,
.template-slot-btn,
.template-replacement-btn {
  pointer-events: auto;
}

.template-editor-toggle {
  justify-self: start;
  border: 0;
  border-radius: 12px;
  padding: 11px 16px;
  background: rgba(34, 34, 38, 0.92);
  color: #f4f4f7;
  font: inherit;
  font-weight: 700;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.32);
  cursor: pointer;
}

.template-editor-panel {
  background: rgba(32, 32, 37, 0.92);
  color: #f1f1f4;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  padding: 16px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  display: grid;
  gap: 14px;
  max-height: min(84vh, 820px);
  overflow: auto;
}

.template-editor-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.template-editor-head strong {
  display: block;
  font-size: 1rem;
}

.template-editor-head p {
  margin: 6px 0 0;
  color: rgba(241, 241, 244, 0.78);
  font-size: 0.9rem;
}

.template-editor-message {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  color: #f4f4f7;
  font-size: 0.92rem;
}

.template-editor-message.is-error {
  background: rgba(166, 55, 71, 0.28);
}

.template-editor-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.template-editor-section {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 12px;
  display: grid;
  gap: 10px;
}

.template-editor-section-wide {
  grid-column: span 1;
}

.template-editor-section h4 {
  margin: 0;
  font-size: 0.92rem;
  color: rgba(255, 255, 255, 0.92);
}

.template-slot-list,
.template-replacement-list,
.template-editor-actions,
.template-editor-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.template-slot-list {
  max-height: 150px;
  overflow: auto;
}

.template-slot-btn,
.template-replacement-card,
.template-editor-mini-btn {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font: inherit;
  padding: 9px 12px;
  cursor: pointer;
}

.template-slot-btn.active {
  background: rgba(93, 71, 143, 0.95);
  border-color: rgba(255, 255, 255, 0.22);
}

.template-replacement-card {
  width: 100%;
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 8px;
  text-align: left;
}

.template-replacement-thumb {
  width: 58px;
  height: 58px;
  border-radius: 10px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.template-replacement-label {
  font-size: 0.92rem;
  color: #fff;
  line-height: 1.25;
}

.template-editor-field {
  display: grid;
  gap: 6px;
  font-size: 0.88rem;
}

.template-editor-field span {
  color: rgba(241, 241, 244, 0.8);
}

.template-editor-field input,
.template-editor-field select {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  padding: 10px 12px;
  font: inherit;
}

.template-editor-checks label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.9);
}

@media (max-width: 980px) {
  .template-editor-overlay {
    left: 10px;
    right: 10px;
    width: auto;
  }

  .template-editor-grid {
    grid-template-columns: 1fr;
  }

  .template-editor-section-wide {
    grid-column: span 1;
  }
}

.template-editor-overlay {
  width: min(560px, calc(100% - 32px));
}

.template-editor-panel {
  max-height: min(86vh, 860px);
}

.template-editor-head p {
  margin: 4px 0 0;
  color: rgba(241, 241, 244, 0.8);
  font-size: 0.9rem;
  line-height: 1.45;
}

.template-editor-mini-btn-primary {
  background: rgba(51, 102, 255, 0.95);
  border-color: rgba(51, 102, 255, 1);
}

.template-editor-mini-btn-primary:hover {
  background: rgba(73, 123, 255, 1);
}

.template-editor-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.template-editor-section {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 14px;
  display: grid;
  gap: 10px;
}

.template-editor-section-wide {
  grid-column: 1 / -1;
}

.template-section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.template-editor-help {
  color: rgba(241, 241, 244, 0.68);
  font-size: 12px;
}

.template-slot-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  max-height: none;
  overflow: visible;
}

.template-slot-btn {
  text-align: left;
  transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}

.template-slot-btn:hover {
  transform: translateY(-1px);
}

.template-slot-btn.active {
  background: rgba(51, 102, 255, 0.25);
  border-color: rgba(51, 102, 255, 0.9);
}

.template-slot-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
}

.template-slot-summary-label {
  color: rgba(241, 241, 244, 0.7);
  font-size: 12px;
}

.template-slot-summary strong {
  font-size: 13px;
}

.template-editor-field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.template-editor-field {
  display: grid;
  gap: 6px;
  font-size: 0.88rem;
}

.template-editor-field span {
  color: rgba(241, 241, 244, 0.8);
}

.template-editor-field input,
.template-editor-field select {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  padding: 10px 12px;
  font: inherit;
}

.template-editor-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.template-editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.template-editor-actions-wrap {
  align-items: center;
}

.template-editor-mini-btn-danger {
  background: rgba(180, 56, 74, 0.16);
  border-color: rgba(180, 56, 74, 0.45);
  color: #ffdce0;
}

.template-editor-mini-btn-danger:hover {
  background: rgba(180, 56, 74, 0.25);
}

.template-editor-details {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
}

.template-editor-details summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.template-editor-details-body {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.template-surface-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.template-surface-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}

.template-surface-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.template-surface-head strong {
  font-size: 0.95rem;
}

.template-surface-head span {
  font-size: 12px;
  color: rgba(241, 241, 244, 0.68);
  word-break: break-word;
}

.template-surface-preset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.template-surface-preset-btn {
  min-height: 72px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background-color: rgba(255, 255, 255, 0.08);
  background-size: cover;
  background-position: center;
  color: #fff;
  cursor: pointer;
  display: grid;
  align-items: end;
  text-align: left;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.template-surface-preset-btn span {
  padding: 5px 7px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.38);
  font-size: 12px;
  line-height: 1.2;
}

.template-surface-preset-btn.active {
  border-color: rgba(51, 102, 255, 0.95);
  box-shadow: inset 0 0 0 1px rgba(51, 102, 255, 0.2), 0 0 0 2px rgba(51, 102, 255, 0.18);
}

.template-surface-color-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.template-surface-color-grid input[type='color'] {
  padding: 4px;
  min-height: 42px;
}

.template-replacement-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.template-replacement-card {
  display: grid;
  gap: 8px;
  justify-items: center;
  align-content: start;
  padding: 10px;
  text-align: center;
}

.template-replacement-thumb {
  width: 100%;
  max-width: 120px;
  aspect-ratio: 1;
  object-fit: contain;
}

.template-replacement-label {
  font-size: 12px;
  line-height: 1.3;
}

.template-tip {
  margin: 0;
  color: rgba(255, 255, 255, 0.8);
  font-size: 11px;
  line-height: 1.4;
}

@media (max-width: 920px) {
  .template-editor-grid,
  .template-editor-field-grid,
  .template-slot-list,
  .template-surface-grid,
  .template-surface-preset-grid,
  .template-surface-color-grid {
    grid-template-columns: 1fr;
  }

  .template-editor-section-wide {
    grid-column: 1 / -1;
  }
}
</style>
