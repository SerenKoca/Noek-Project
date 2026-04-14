<script setup>
const props = defineProps({
  roomName: {
    type: String,
    default: 'Naam kamer'
  }
})
</script>

<template>
  <div class="editor-room-name">
    <span class="editor-room-name-text">{{ props.roomName || 'Naam kamer' }}</span>
  </div>
</template>
