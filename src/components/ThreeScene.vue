<script setup>
import { onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { startGlobalLoading, endGlobalLoading } from '../services/globalLoading.js'

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

// Keep incoming assets within a predictable size range for easier placement.
const MODEL_SIZE_TARGET = 24
const MODEL_SCALE_MIN = 0.5
const MODEL_SCALE_MAX = 20
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

const FURNITURE_SLOTS = [
  { id: 'slot-sofa', position: new THREE.Vector3(10, 0, -12), rotationY: Math.PI },
  { id: 'slot-table', position: new THREE.Vector3(9, 0, -15), rotationY: Math.PI * 0.5 },
  { id: 'slot-tv', position: new THREE.Vector3(14, 0, -9), rotationY: Math.PI },
  { id: 'slot-shelf', position: new THREE.Vector3(6, 0, -8), rotationY: Math.PI * 0.5 }
]

const slotStates = new Map()
let floorMaterial = null
let wallMaterial = null

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
  transform.addEventListener('dragging-changed', (e) => {
    orbit.enabled = !e.value
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
  for (const slot of FURNITURE_SLOTS) {
    slotStates.set(slot.id, {
      id: slot.id,
      position: slot.position.clone(),
      rotationY: slot.rotationY,
      root: null,
      marker: null
    })

    const defaultRoot = createDefaultFurnitureForSlot(slot)
    assignRootToSlot(defaultRoot, slot.id)
  }
}

function createDefaultFurnitureForSlot(slot) {
  const root = new THREE.Group()
  root.userData.isRootModel = true
  root.userData.isSlotMarker = false
  root.userData.slotId = slot.id
  root.userData.id = slot.id
  root.userData.title = slot.id.replace('slot-', '').replace('-', ' ')

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

  // Keep starter furniture visually proportional inside the large room.
  root.scale.setScalar(4)

  return root
}

function createSlotMarker(slotId) {
  const root = new THREE.Group()
  root.userData.isRootModel = true
  root.userData.isSlotMarker = true
  root.userData.slotId = slotId
  root.userData.id = `marker-${slotId}`
  root.userData.title = 'Plaats hier'

  const markerMat = new THREE.MeshStandardMaterial({ color: 0x2b7dd8, roughness: 0.75, metalness: 0.1 })
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.12), markerMat)
  h.position.set(0, 0.3, 0)
  root.add(h)

  const v = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), markerMat)
  v.position.set(0, 0.3, 0)
  root.add(v)

  return root
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
  root.userData.isSlotMarker = false
  root.position.copy(slot.position)
  root.rotation.set(0, slot.rotationY, 0)

  scene.add(root)
  selectableRoots.push(root)
  slot.root = root
  select(root)
}

function removeFurnitureFromSlot(slotId) {
  const slot = slotStates.get(slotId)
  if (!slot || !slot.root) return

  removeRoot(slot.root)
  slot.root = null

  const marker = createSlotMarker(slotId)
  marker.position.copy(slot.position)
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
  transform.detach()
  transform.visible = false
  emit('selected', null)
  emit('selected-anchor', null)
}

function select(root) {
  selectedRoot = root
  const info = {
    uuid: root?.uuid || '',
    id: root?.userData?.id || '',
    title: root?.userData?.title || '',
    slotId: root?.userData?.slotId || '',
    isSlotMarker: !!root?.userData?.isSlotMarker
  }
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
      isEmpty: false
    })
  }

  const result = {
    metadata: {
      savedAt: new Date().toISOString(),
      roomSize: ROOM_SIZE,
      wallHeight: WALL_HEIGHT
    },
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
  if (!sceneData || !Array.isArray(sceneData.furniture)) {
    // Reset to default state for new rooms
    resetSceneToDefault()
    applyRoomColors()
    return
  }

  // Reset scene to default state first
  resetSceneToDefault()
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
          replaceRoot: { slotId }
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
      if (item.position) defaultRoot.position.fromArray(item.position)
      if (item.rotationY !== undefined) defaultRoot.rotation.y = item.rotationY
      if (item.scale) defaultRoot.scale.fromArray(item.scale)
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

function resetSceneToDefault() {
  // Remove all current objects
  for (const slot of FURNITURE_SLOTS) {
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

function centerAndGround(object3D) {
  const box = new THREE.Box3().setFromObject(object3D)
  if (!isFinite(box.min.x) || !isFinite(box.max.x)) return

  const size = new THREE.Vector3()
  box.getSize(size)

  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim > 0) {
    const targetScale = THREE.MathUtils.clamp(MODEL_SIZE_TARGET / maxDim, MODEL_SCALE_MIN, MODEL_SCALE_MAX)
    object3D.scale.multiplyScalar(targetScale)
  }

  // Recompute box after scaling
  const box2 = new THREE.Box3().setFromObject(object3D)
  const center = new THREE.Vector3()
  box2.getCenter(center)

  object3D.position.x -= center.x
  object3D.position.z -= center.z

  // Sit on the floor: move so minY == 0
  const box3 = new THREE.Box3().setFromObject(object3D)
  const minY = box3.min.y
  if (isFinite(minY)) {
    object3D.position.y -= minY
  }
}

async function loadModelAsset({ url, title, id, replaceRoot = null }) {
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
          centerAndGround(holder)

          const targetSlotId = replaceRoot?.userData?.slotId || replaceRoot?.slotId || ''
          if (!targetSlotId || !slotStates.has(targetSlotId)) {
            reject(new Error('Selecteer eerst een meubel of pluspositie in de kamer.'))
            return
          }

          assignRootToSlot(holder, targetSlotId)

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

      await loadModelAsset({ url: assetUrl, title, id, replaceRoot })
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

onMounted(() => {
  createScene()
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
      class="pointer-events-none rounded bg-black/70 px-3 py-2 text-xs text-white"
      style="position: fixed; top: 108px; right: 14px; z-index: 120; min-width: 230px;"
    >
      <div>Camera: {{ cameraCoords }}</div>
      <div>Target: {{ targetCoords }}</div>
    </div>
  </div>
</template>
