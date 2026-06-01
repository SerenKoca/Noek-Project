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
  },
  isPositionEditMode: {
    type: Boolean,
    default: false
  }
  ,
  slotMarkers: {
    type: Array,
    default: () => []
  }
})

defineEmits(['delete-selected', 'rotate-selected', 'confirm-edit-selected', 'cancel-edit-selected', 'edit-selected'])
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
    <template v-if="isPositionEditMode && !selected?.isSlotMarker">
      <button class="scene-tool-confirm" @click="$emit('confirm-edit-selected')">✔</button>
      <button class="scene-tool-cancel" @click="$emit('cancel-edit-selected')">✖</button>
    </template>
    <template v-else>
      <button class="scene-tool-main" @click="$emit('edit-selected')">{{ selected?.isSlotMarker ? 'plaats' : 'aanpassen' }}</button>
      <button v-if="!selected?.isSlotMarker" class="scene-tool-rotate" @click="$emit('rotate-selected', 90)">⟳</button>
      <button v-if="!selected?.isSlotMarker" class="scene-tool-danger" @click="$emit('delete-selected')">x</button>
    </template>
  </div>

  <div>
    <div
      v-for="m in slotMarkers"
      :key="m.slotId"
      class="scene-slot-popup"
      :style="{ left: `${m.x}px`, top: `${m.y}px` }"
      @click="$emit('place-slot', m.slotId)"
    >
      <div class="scene-slot-inner">+</div>
    </div>
  </div>
</template>
