<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { fetchModels } from '../services/polyPizzaService'
import SidebarAssetsNav from './sidebar/SidebarAssetsNav.vue'
import SidebarSubNav from './sidebar/SidebarSubNav.vue'
import SidebarModelsPanel from './sidebar/SidebarModelsPanel.vue'
import SidebarSoundsPanel from './sidebar/SidebarSoundsPanel.vue'

const props = defineProps({
  selected: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['load-model', 'delete-selected', 'select-sound'])

const loading = ref(false)
const error = ref('')
const models = ref([])
const activeCategory = ref('Meubels')
const activeSubCategory = ref('Sofa\'s')

const filteredModels = computed(() => models.value)
const isSoundCategory = computed(() => activeCategory.value === 'Geluid')

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

  if (activeSubCategory.value === 'Alle') {
    activeSubCategory.value = 'Sofa\'s'
  }
})
</script>

<template>
  <aside class="editor-sidebar-shell">
    <div class="editor-sidebar-grid">
      <SidebarAssetsNav
        :active-category="activeCategory"
        @update:active-category="activeCategory = $event"
      />

      <SidebarSubNav
        :active-category="activeCategory"
        :active-sub-category="activeSubCategory"
        @update:active-sub-category="activeSubCategory = $event"
      />

      <SidebarSoundsPanel
        v-if="isSoundCategory"
        :active-sub-category="activeSubCategory"
        @select-sound="emit('select-sound', $event)"
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
