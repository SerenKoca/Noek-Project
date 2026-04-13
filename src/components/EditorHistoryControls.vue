<script setup>
defineEmits(['undo', 'redo'])
</script>

<template>
  <div class="editor-history-controls">
    <button class="editor-icon-btn lg" aria-label="Undo" @click="$emit('undo')">
      <svg viewBox="0 0 24 24" class="editor-svg-icon" aria-hidden="true"><path d="M12 5a7 7 0 00-6.6 4.7H8v2H2V5h2v2.3A9 9 0 1121 12h-2A7 7 0 0012 5z"/></svg>
    </button>
    <button class="editor-icon-btn lg" aria-label="Redo" @click="$emit('redo')">
      <svg viewBox="0 0 24 24" class="editor-svg-icon" aria-hidden="true"><path d="M12 5a7 7 0 016.6 4.7H16v2h6V5h-2v2.3A9 9 0 103 12h2A7 7 0 0112 5z"/></svg>
    </button>
  </div>
</template>
