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
  }
})

defineEmits(['reload', 'delete-selected', 'request-load', 'request-load-with-mode'])
</script>

<template>
  <section class="editor-models-panel">
    <div class="editor-models-header">
      <button class="editor-mini-btn" :disabled="loading" @click="$emit('reload')">r</button>
      <button class="editor-mini-btn" :disabled="!selected || selected?.isSlotMarker" @click="$emit('delete-selected')">x</button>
    </div>

    <div class="editor-quick-actions">
      <button class="editor-action-btn" :disabled="!selected || selected?.isSlotMarker" @click="$emit('delete-selected')">Verwijder</button>
      <button class="editor-action-btn" @click="$emit('reload')">Herladen</button>
    </div>

    <div v-if="error" class="editor-inline-error">
      {{ error }}
    </div>

    <div v-if="loading" class="editor-loading">Loading...</div>

    <ul v-else class="editor-model-grid">
      <li v-for="m in models" :key="m.id || m.ID" class="editor-model-card">
        <button class="editor-model-tile" @click="$emit('request-load', m)">
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
            class="editor-model-primary"
            @click="$emit('request-load', m)"
          >
            {{ selected?.isSlotMarker ? 'Plaats' : (selected ? 'Vervang' : 'Plaats') }}
          </button>
          <button
            v-if="selected"
            class="editor-model-secondary"
            @click="$emit('request-load-with-mode', m, 'add')"
          >
            +
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>
