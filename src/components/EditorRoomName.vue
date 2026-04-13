<script setup>
const props = defineProps({
  roomName: {
    type: String,
    default: 'Naam kamer'
  }
})

const emit = defineEmits(['update:roomName'])

function onInput(event) {
  emit('update:roomName', event.target.value)
}
</script>

<template>
  <div class="editor-room-name">
    <input
      class="editor-room-name-input"
      type="text"
      :value="props.roomName"
      @input="onInput"
      placeholder="Naam kamer"
    />
  </div>
</template>
