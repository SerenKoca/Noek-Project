<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { fetchModels } from '../services/polyPizzaService'
import SidebarAssetsNav from './sidebar/SidebarAssetsNav.vue'
import SidebarSubNav from './sidebar/SidebarSubNav.vue'
import SidebarModelsPanel from './sidebar/SidebarModelsPanel.vue'
import SidebarSoundsPanel from './sidebar/SidebarSoundsPanel.vue'
import SidebarColorsPanel from './sidebar/SidebarColorsPanel.vue'

const props = defineProps({
  selected: {
    type: Object,
    default: null
  },
  roomAppearance: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['load-model', 'delete-selected', 'select-sound', 'apply-room-colors'])

const loading = ref(false)
const error = ref('')
const models = ref([])
const activeCategory = ref('Meubels')
const activeSubCategory = ref('Alle')

const isSoundCategory = computed(() => activeCategory.value === 'Geluid')
const isColorCategory = computed(() => activeCategory.value === 'Kleuren')
const DEFAULT_FURNITURE_SUBCATEGORIES = ['Alle', 'Zetel', 'Lamp', 'Tafel', 'Kast', 'Muurdecoratie', 'Decoratie klein', 'Decoratie groot', 'Dieren', 'Foto', 'Video', 'Muziek', 'Persoonlijk']

const VEHICLE_KEYWORDS = ['car', 'truck', 'vehicle', 'police', 'mitsubishi', 'bus', 'tractor', 'bike', 'motor']
const SOFA_KEYWORDS = ['sofa', 'couch', 'armchair', 'chair', 'loveseat', 'stool', 'bench']
const FURNITURE_KEYWORDS = [
  'table',
  'desk',
  'cabinet',
  'shelf',
  'bookcase',
  'wardrobe',
  'bed',
  'lamp',
  'dresser',
  'tv',
  'television',
  'console',
  'armchair'
]
const DECOR_KEYWORDS = ['candle', 'vase', 'plant', 'frame', 'painting', 'statue', 'clock', 'flower', 'pot', 'wall art', 'poster', 'mirror']
const PERSONAL_KEYWORDS = ['photo', 'portrait', 'book', 'letter', 'memory', 'card', 'album']
const VIDEO_KEYWORDS = ['tv', 'television', 'screen', 'monitor', 'video', 'cinema', 'projector']
const MUSIC_KEYWORDS = ['radio', 'speaker', 'boombox', 'stereo', 'jukebox', 'record player', 'gramophone', 'microphone', 'music']
const PHOTO_KEYWORDS = ['photo', 'picture', 'camera', 'album', 'frame', 'portrait']
const ANIMAL_KEYWORDS = ['cat', 'dog', 'wolf', 'fox', 'lion', 'tiger', 'bear', 'bird', 'owl', 'duck', 'horse', 'cow', 'rabbit', 'deer', 'elephant', 'zebra', 'giraffe', 'animal', 'pet']
const TABLE_KEYWORDS = ['table', 'desk']
const SHELF_KEYWORDS = ['cabinet', 'bookcase', 'shelf', 'wardrobe', 'closet', 'dresser']
const STAND_KEYWORDS = ['stand', 'rack', 'hanger', 'coat']
const LAMP_KEYWORDS = ['lamp', 'light', 'lantern', 'chandelier', 'bulb']

const SLOT_ALLOWED_SUBTYPES = {
  'slot-sofa': ['Zetel'],
  'slot-armchair-right': ['Zetel'],
  'slot-table': ['Tafel', 'Decoratie klein', 'Decoratie groot', 'Persoonlijk'],
  'slot-tv': ['Video', 'Muziek', 'Foto', 'Muurdecoratie'],
  'slot-shelf': ['Kast', 'Decoratie klein', 'Decoratie groot', 'Persoonlijk'],
  'slot-hat-stand': ['Lamp', 'Decoratie klein', 'Decoratie groot'],
  'slot-candle-side': ['Decoratie klein', 'Decoratie groot', 'Persoonlijk']
}

function getAllowedSubtypesForSelectedSlot() {
  const slotCategories = Array.isArray(props.selected?.slotCategories)
    ? [...new Set(props.selected.slotCategories.map((item) => String(item || '').trim()).filter(Boolean))]
    : []

  if (slotCategories.length) {
    const out = []
    for (const category of slotCategories) {
      if (category === 'Media') {
        out.push('Foto', 'Video', 'Muziek')
      } else {
        out.push(category)
      }
    }
    return [...new Set(out)]
  }

  const slotId = String(props.selected?.slotId || '')
  if (slotId && SLOT_ALLOWED_SUBTYPES[slotId]) {
    return SLOT_ALLOWED_SUBTYPES[slotId]
  }

  return []
}

function inferModelKind(model) {
  const text = modelText(model)
  if (containsAny(text, PERSONAL_KEYWORDS)) return 'persoonlijk'
  if (containsAny(text, ANIMAL_KEYWORDS)) return 'decoratie'
  if (containsAny(text, DECOR_KEYWORDS)) return 'decoratie'
  return 'meubel'
}

function inferModelCategory(model) {
  const text = modelText(model)
  const kind = inferModelKind(model)

  if (kind === 'persoonlijk') return 'persoonlijk'
  if (containsAny(text, ANIMAL_KEYWORDS)) return 'Dieren'
  if (containsAny(text, MUSIC_KEYWORDS)) return 'Muziek'
  if (containsAny(text, VIDEO_KEYWORDS)) return 'Video'
  if (containsAny(text, PHOTO_KEYWORDS)) return 'Foto'
  if (containsAny(text, ['frame', 'painting', 'wall art', 'poster', 'mirror', 'wall decoration'])) return 'Muurdecoratie'
  if (containsAny(text, LAMP_KEYWORDS)) return 'Lamp'
  if (containsAny(text, TABLE_KEYWORDS)) return 'Tafel'
  if (containsAny(text, SHELF_KEYWORDS)) return 'Kast'
  if (containsAny(text, STAND_KEYWORDS)) return 'Lamp'
  if (containsAny(text, SOFA_KEYWORDS)) return 'Zetel'
  if (kind === 'decoratie') return inferDecorationSizeCategory(model)
  return 'Decoratie groot'
}

function inferDecorationSizeCategory(model) {
  const sizeMultiplier = getModelSizeMultiplier(model)
  if (sizeMultiplier <= 1) return 'Decoratie klein'
  return 'Decoratie groot'
}

function isAllowedForSelectedSlot(model) {
  const allowedSubtypes = getAllowedSubtypesForSelectedSlot()
  if (allowedSubtypes.length) {
    const category = inferModelCategory(model)
    const decorationCategory = inferModelKind(model) === 'decoratie' ? inferDecorationSizeCategory(model) : null
    return allowedSubtypes.includes(category) || (decorationCategory && allowedSubtypes.includes(decorationCategory))
  }

  const accepts = Array.isArray(props.selected?.slotAccepts) ? props.selected.slotAccepts : []
  if (!accepts.length) return true
  if (accepts.includes('alles')) return true

  const kind = inferModelKind(model)
  return accepts.includes(kind)
}

function modelText(model) {
  const title = String(model?.title || model?.name || model?.Title || '').toLowerCase()
  const category = String(model?.metadata?.category || model?.Category || '').toLowerCase()
  const tags = Array.isArray(model?.metadata?.tags)
    ? model.metadata.tags.join(' ').toLowerCase()
    : Array.isArray(model?.Tags)
      ? model.Tags.join(' ').toLowerCase()
      : ''
  return `${title} ${category} ${tags}`.trim()
}

function containsAny(text, keywords) {
  return keywords.some((word) => text.includes(word))
}

function getModelSizeMultiplier(model) {
  const text = modelText(model)

  if (containsAny(text, ['computer', 'desktop', 'monitor', 'screen', 'laptop'])) return 0.72
  if (containsAny(text, ['tv', 'television'])) return 0.95
  if (containsAny(text, ['table', 'desk'])) return 1.15
  if (containsAny(text, ['chair', 'stool'])) return 1.05
  if (containsAny(text, ['sofa', 'couch', 'bench', 'armchair'])) return 1.28
  if (containsAny(text, ['cabinet', 'bookcase', 'shelf', 'wardrobe', 'closet'])) return 1.5
  return 1
}

function inferModelSizeTier(model) {
  const sizeMultiplier = getModelSizeMultiplier(model)
  if (sizeMultiplier <= 0.95) return 'klein'
  if (sizeMultiplier >= 1.2) return 'groot'
  return 'middel'
}

function isVehicleModel(model) {
  const text = modelText(model)
  return containsAny(text, VEHICLE_KEYWORDS) || text.includes('transport')
}

function matchesActiveFurnitureSubCategory(model, subCategory = activeSubCategory.value) {
  if (subCategory === 'Alle') return true

  if (subCategory === 'Muurdecoratie') {
    return inferModelCategory(model) === 'Muurdecoratie'
  }

  if (subCategory === 'Dieren') {
    return inferModelCategory(model) === 'Dieren'
  }

  if (subCategory === 'Foto') {
    return inferModelCategory(model) === 'Foto'
  }

  if (subCategory === 'Video') {
    return inferModelCategory(model) === 'Video'
  }

  if (subCategory === 'Muziek') {
    return inferModelCategory(model) === 'Muziek'
  }

  if (subCategory === 'Decoratie klein') {
    return inferModelKind(model) === 'decoratie' && getModelSizeMultiplier(model) <= 1
  }

  if (subCategory === 'Decoratie groot') {
    return inferModelKind(model) === 'decoratie' && getModelSizeMultiplier(model) > 1
  }

  if (subCategory === 'Persoonlijk') {
    return inferModelKind(model) === 'persoonlijk'
  }

  return inferModelCategory(model) === subCategory
}

const filteredModels = computed(() => {
  const list = Array.isArray(models.value) ? models.value : []
  if (!list.length) return []

  if (activeCategory.value !== 'Meubels') {
    return list
  }

  const slotCompatible = props.selected ? list.filter((item) => isAllowedForSelectedSlot(item)) : list

  if (activeSubCategory.value === 'Alle') {
    return slotCompatible
  }

  const bySubCategory = slotCompatible.filter((item) => matchesActiveFurnitureSubCategory(item))

  return bySubCategory
})

const allowedSubCategories = computed(() => {
  if (activeCategory.value === 'Geluid') {
    return ['Alle', 'Natuur', 'Instrumentaal', 'Overig']
  }

  if (activeCategory.value === 'Kleuren') {
    return ['Paletten', 'Neutraal', 'Aarde', 'Koel']
  }

  const allowed = getAllowedSubtypesForSelectedSlot()

  if (!allowed.length) {
    return DEFAULT_FURNITURE_SUBCATEGORIES
  }

  const out = ['Alle']
  if (allowed.includes('Zetel')) out.push('Zetel')
  if (allowed.includes('Lamp')) out.push('Lamp')
  if (allowed.includes('Tafel')) out.push('Tafel')
  if (allowed.includes('Kast')) out.push('Kast')
  if (allowed.includes('Muurdecoratie')) out.push('Muurdecoratie')
  if (allowed.includes('Dieren')) out.push('Dieren')
  if (allowed.includes('Foto')) out.push('Foto')
  if (allowed.includes('Video')) out.push('Video')
  if (allowed.includes('Muziek')) out.push('Muziek')
  if (allowed.includes('Media')) out.push('Foto', 'Video', 'Muziek')
  if (allowed.includes('Decoratie klein') || allowed.includes('Decoratie groot')) {
    out.push('Decoratie klein', 'Decoratie groot')
  }
  if (allowed.includes('Persoonlijk')) {
    out.push('Persoonlijk')
  }

  return out
})

function buildLoadPayload(model) {
  const resolvedTitle = model?.title || model?.name || model?.Title || 'Untitled model'
  const resolvedUrl = model?.url || model?.downloadUrl || model?.Download || ''
  const resolvedThumbnail = model?.thumbnailUrl || model?.previewUrl || model?.Thumbnail || ''
  const resolvedId = model?.id || model?.ID || ''
  const sizeMultiplier = getModelSizeMultiplier(model)

  return {
    id: resolvedId,
    title: resolvedTitle,
    name: resolvedTitle,
    url: resolvedUrl,
    downloadUrl: resolvedUrl,
    thumbnailUrl: resolvedThumbnail,
    previewUrl: resolvedThumbnail,
    attribution: model?.attribution || model?.Attribution || '',
    licence: model?.licence || model?.Licence || '',
    sizeMultiplier,
    modelCategory: inferModelCategory(model),
    source: model?.source || 'unknown'
  }
}

function requestLoad(model) {
  requestLoadWithMode(model, 'replace-selected')
}

function requestLoadWithMode(model, mode = 'add') {
  const effectiveMode = mode === 'add' ? 'replace-selected' : mode
  const payload = buildLoadPayload(model)

  if (activeCategory.value === 'Meubels' && !matchesActiveFurnitureSubCategory(model)) {
    error.value = `Dit object hoort niet bij de categorie "${activeSubCategory.value}".`
    return
  }

  if (!isAllowedForSelectedSlot(model)) {
    const slotLabel = String(props.selected?.slotLabel || 'deze plek')
    error.value = `Dit type object is niet toegestaan op ${slotLabel}.`
    return
  }

  if (!payload.url) {
    error.value = `Selected model "${payload.title}" is missing a download URL.`
    console.error('Model missing URL for load request', { model })
    return
  }

  if (effectiveMode === 'replace-selected' && props.selected?.uuid) {
    payload.placementMode = 'replace-selected'
    payload.targetUuid = props.selected.uuid
    payload.targetSlotId = props.selected.slotId || ''
  } else if (effectiveMode === 'replace-selected') {
    payload.placementMode = 'add'
  }

  emit('load-model', payload)
}

async function loadFromApi() {
  loading.value = true
  error.value = ''

  const res = await fetchModels({ max: 200 })
  models.value = Array.isArray(res.models) ? res.models : []
  error.value = res.error || ''

  loading.value = false
}

function deleteSelected() {
  emit('delete-selected')
}

onMounted(() => {
  loadFromApi()
})

watch(activeCategory, (value) => {
  if (value === 'Geluid') {
    activeSubCategory.value = 'Alle'
    return
  }

  if (value === 'Kleuren') {
    activeSubCategory.value = 'Kleuren'
    return
  }

  if (activeSubCategory.value === 'Paletten') {
    activeSubCategory.value = 'Alle'
  }
})

watch(allowedSubCategories, (list) => {
  if (!Array.isArray(list) || !list.length) return
  if (!list.includes(activeSubCategory.value)) {
    activeSubCategory.value = list[0]
  }
})
</script>

<template>
  <aside class="editor-sidebar-shell">
    <div class="editor-sidebar-grid" :class="{ 'is-colors': isColorCategory }">
      <SidebarAssetsNav
        :active-category="activeCategory"
        @update:active-category="activeCategory = $event"
      />

      <SidebarSubNav
        v-if="!isColorCategory"
        :active-category="activeCategory"
        :active-sub-category="activeSubCategory"
        :allowed-sub-categories="allowedSubCategories"
        @update:active-sub-category="activeSubCategory = $event"
      />

      <SidebarSoundsPanel
        v-if="isSoundCategory"
        :active-sub-category="activeSubCategory"
        @select-sound="emit('select-sound', $event)"
      />

      <SidebarColorsPanel
        v-else-if="isColorCategory"
        :active-sub-category="activeSubCategory"
        :room-appearance="props.roomAppearance"
        @apply-colors="emit('apply-room-colors', $event)"
      />

      <SidebarModelsPanel
        v-else
        :loading="loading"
        :error="error"
        :selected="props.selected"
        :models="filteredModels"
        @reload="loadFromApi"
        @delete-selected="deleteSelected"
        @request-load="requestLoad"
        @request-load-with-mode="requestLoadWithMode"
      />
    </div>
  </aside>
</template>
