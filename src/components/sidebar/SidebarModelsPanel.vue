<script setup>
defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  },
  selected: {
    type: Object,
    default: null
  },
  models: {
    type: Array,
    default: () => []
  },
  isPositionEditMode: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'reload',
  'delete-selected',
  'request-load',
  'request-load-with-mode',
  'edit-selected',
  'confirm-edit-selected',
  'cancel-edit-selected',
  'rotate-selected',
  'close'
])

function handleEditSelected() {
  console.debug('[SidebarModelsPanel] emit edit-selected')
  emit('edit-selected')
}

function handleConfirmEditSelected() {
  console.debug('[SidebarModelsPanel] emit confirm-edit-selected')
  emit('confirm-edit-selected')
}

function handleCancelEditSelected() {
  console.debug('[SidebarModelsPanel] emit cancel-edit-selected')
  emit('cancel-edit-selected')
}

function handleRotateSelected() {
  console.debug('[SidebarModelsPanel] emit rotate-selected 90')
  emit('rotate-selected', 90)
}

function handleDeleteSelected() {
  console.debug('[SidebarModelsPanel] emit delete-selected')
  emit('delete-selected')
}
</script>

<style scoped>
.editor-models-panel {
  max-height: calc(100vh - 180px);
  overflow-y: auto;
  min-height: 0;
  padding-right: 4px;
}

.editor-model-scroll {
  overflow-y: auto;
  min-height: 0;
}
</style>

<template>
  <section class="editor-models-panel">
    <div class="editor-models-header">
      <button type="button" class="editor-mini-btn" :disabled="loading" @click="$emit('reload')">r</button>
      <button
        type="button"
        class="editor-mini-btn editor-close-btn"
        @pointerdown.stop.prevent="$emit('close')"
        @click.stop.prevent="$emit('close')"
        aria-label="Sluiten"
        title="Sluiten"
      >
        ×
      </button>
    </div>

    <div class="editor-quick-actions">
      <template v-if="selected">
        <template v-if="isPositionEditMode">
          <button
            type="button"
            class="editor-action-btn editor-action-btn-icon editor-action-btn-cancel"
            aria-label="Wijziging annuleren"
            title="Wijziging annuleren"
            @click="handleCancelEditSelected"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="editor-action-btn editor-action-btn-icon editor-action-btn-confirm"
            aria-label="Wijziging opslaan"
            title="Wijziging opslaan"
            @click="handleConfirmEditSelected"
          >
            <i class="fa-solid fa-check" aria-hidden="true"></i>
          </button>
        </template>
        <template v-else>
          <button type="button" class="editor-action-btn" @click="handleEditSelected">Aanpassen</button>
          <button type="button" class="editor-action-btn" @click="handleRotateSelected">Draaien 90°</button>
          <button type="button" class="editor-action-btn" @click="handleDeleteSelected">Verwijder</button>
        </template>
      </template>
      <template v-else>
        <button type="button" class="editor-action-btn" @click="$emit('reload')">Herladen</button>
      </template>
    </div>

    

    <div v-if="error" class="editor-inline-error">
      {{ error }}
    </div>

    <div v-if="loading" class="editor-loading">Loading...</div>

    <div v-else class="editor-model-scroll">
      <ul class="editor-model-grid">
        <li v-for="m in models" :key="m.id || m.ID" class="editor-model-card">
          <button type="button" class="editor-model-tile" @click="$emit('request-load', m)">
            <img
              v-if="m.thumbnailUrl || m.previewUrl || m.Thumbnail"
              :src="m.thumbnailUrl || m.previewUrl || m.Thumbnail"
              alt=""
              class="editor-model-thumb"
              loading="lazy"
            />
            <div v-else class="editor-model-thumb empty"></div>
          </button>
          <div class="editor-model-actions">
            <button
              type="button"
              class="editor-model-primary"
              @click="$emit('request-load', m)"
            >
              {{ selected?.isSlotMarker ? 'Plaats' : (selected ? 'Vervang' : 'Plaats') }}
            </button>
            <button
              type="button"
              v-if="selected"
              class="editor-model-secondary"
              @click="$emit('request-load-with-mode', m, 'add')"
            >
              +
            </button>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
