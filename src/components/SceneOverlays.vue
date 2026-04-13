<script setup>
defineProps({
  errorMessage: {
    type: String,
    default: ''
  },
  selected: {
    type: Object,
    default: null
  },
  selectedAnchor: {
    type: Object,
    default: null
  }
})

defineEmits(['delete-selected'])
</script>

<template>
  <div v-if="errorMessage" class="editor-scene-overlays">
    <div class="scene-error">
      {{ errorMessage }}
    </div>
  </div>

  <div
    v-if="selected && selectedAnchor"
    class="scene-floating-tools"
    :style="{ left: `${selectedAnchor.x}px`, top: `${selectedAnchor.y}px` }"
  >
    <button class="scene-tool-main">{{ selected?.isSlotMarker ? 'plaats' : 'aanpassen' }}</button>
    <button v-if="!selected?.isSlotMarker" class="scene-tool-danger" @click="$emit('delete-selected')">x</button>
  </div>
</template>
