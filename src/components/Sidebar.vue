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
const activeSubCategory = ref('Sofa\'s')

const isSoundCategory = computed(() => activeCategory.value === 'Geluid')
const isColorCategory = computed(() => activeCategory.value === 'Kleuren')

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
const DECOR_KEYWORDS = ['candle', 'vase', 'plant', 'frame', 'painting', 'statue', 'clock', 'flower', 'pot']
const PERSONAL_KEYWORDS = ['photo', 'portrait', 'book', 'letter', 'memory', 'card', 'album']

function inferModelKind(model) {
  const text = modelText(model)
  if (containsAny(text, PERSONAL_KEYWORDS)) return 'persoonlijk'
  if (containsAny(text, DECOR_KEYWORDS)) return 'decoratie'
  return 'meubel'
}

function isAllowedForSelectedSlot(model) {
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

function isVehicleModel(model) {
  const text = modelText(model)
  return containsAny(text, VEHICLE_KEYWORDS) || text.includes('transport')
}

const filteredModels = computed(() => {
  const list = Array.isArray(models.value) ? models.value : []
  if (!list.length) return []

  if (activeCategory.value !== 'Meubels') {
    return list
  }

  const nonVehicle = list.filter((item) => !isVehicleModel(item))
  const base = nonVehicle.length ? nonVehicle : list

  const bySubCategory = base.filter((item) => {
    const text = modelText(item)

    if (activeSubCategory.value === 'Sofa\'s') {
      return containsAny(text, SOFA_KEYWORDS)
    }

    if (activeSubCategory.value === 'Meubels') {
      return containsAny(text, FURNITURE_KEYWORDS) || containsAny(text, SOFA_KEYWORDS)
    }

    if (activeSubCategory.value === 'Decoratie') {
      return containsAny(text, DECOR_KEYWORDS)
    }

    if (activeSubCategory.value === 'Persoonlijk') {
      return containsAny(text, PERSONAL_KEYWORDS) || containsAny(text, DECOR_KEYWORDS)
    }

    return true
  })

  const bySlotRule = bySubCategory.filter((item) => isAllowedForSelectedSlot(item))
  return bySlotRule
})

function buildLoadPayload(model) {
  const resolvedTitle = model?.title || model?.name || model?.Title || 'Untitled model'
  const resolvedUrl = model?.url || model?.downloadUrl || model?.Download || ''
  const resolvedThumbnail = model?.thumbnailUrl || model?.previewUrl || model?.Thumbnail || ''
  const resolvedId = model?.id || model?.ID || ''

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
    source: model?.source || 'unknown'
  }
}

function requestLoad(model) {
  requestLoadWithMode(model, 'replace-selected')
}

function requestLoadWithMode(model, mode = 'add') {
  const effectiveMode = mode === 'add' ? 'replace-selected' : mode
  const payload = buildLoadPayload(model)

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
    error.value = 'Selecteer eerst een meubel of pluspositie in de kamer.'
    return
  }

  emit('load-model', payload)
}

async function loadFromApi() {
  loading.value = true
  error.value = ''

  const res = await fetchModels({ max: 12 })
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

  if (activeSubCategory.value === 'Alle') {
    activeSubCategory.value = 'Sofa\'s'
  }

  if (activeSubCategory.value === 'Paletten') {
    activeSubCategory.value = 'Sofa\'s'
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
