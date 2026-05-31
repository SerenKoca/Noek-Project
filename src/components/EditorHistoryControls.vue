<script setup>
defineEmits(['undo', 'redo'])
</script>

<template>
  <div class="editor-history-controls">
    <button class="editor-icon-btn lg" aria-label="Undo" @click="$emit('undo', 'undo')">
      <i class="fa-solid fa-rotate-left editor-fa-icon" aria-hidden="true"></i>
    </button>
    <button class="editor-icon-btn lg" aria-label="Redo" @click="$emit('redo', 'redo')">
      <i class="fa-solid fa-rotate-right editor-fa-icon" aria-hidden="true"></i>
    </button>
  </div>
</template>
