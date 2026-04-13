<script setup>
defineEmits(['settings', 'home', 'save', 'share'])
</script>

<template>
  <div class="editor-top-left">
    <button class="editor-icon-btn" aria-label="Settings" @click="$emit('settings')">
      <svg viewBox="0 0 24 24" class="editor-svg-icon" aria-hidden="true"><path d="M19.14,12.94a7.49,7.49,0,0,0,.05-.94,7.49,7.49,0,0,0-.05-.94l2.11-1.65a.5.5,0,0,0,.12-.64l-2-3.46a.5.5,0,0,0-.6-.22l-2.49,1a7.44,7.44,0,0,0-1.63-.94l-.38-2.65A.5.5,0,0,0,13.78,2H10.22a.5.5,0,0,0-.49.42L9.35,5.07a7.44,7.44,0,0,0-1.63.94l-2.49-1a.5.5,0,0,0-.6.22l-2,3.46a.5.5,0,0,0,.12.64L4.86,11.06a7.49,7.49,0,0,0-.05.94,7.49,7.49,0,0,0,.05.94L2.75,14.59a.5.5,0,0,0-.12.64l2,3.46a.5.5,0,0,0,.6.22l2.49-1a7.44,7.44,0,0,0,1.63.94l.38,2.65a.5.5,0,0,0,.49.42h3.56a.5.5,0,0,0,.49-.42l.38-2.65a7.44,7.44,0,0,0,1.63-.94l2.49,1a.5.5,0,0,0,.6-.22l2-3.46a.5.5,0,0,0-.12-.64ZM12,15.5A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"/></svg>
    </button>
    <button class="editor-icon-btn" aria-label="Home" @click="$emit('home')">
      <svg viewBox="0 0 24 24" class="editor-svg-icon" aria-hidden="true"><path d="M12 3l9 7h-3v10h-5v-6H11v6H6V10H3z"/></svg>
    </button>
    <button class="editor-icon-btn" aria-label="Save" @click="$emit('save')">
      <svg viewBox="0 0 24 24" class="editor-svg-icon" aria-hidden="true"><path d="M5 3h12l4 4v14H3V3zm3 0v6h8V3H8zm4 16a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/></svg>
    </button>
    <button class="editor-icon-btn" aria-label="Share" @click="$emit('share')">
      <svg viewBox="0 0 24 24" class="editor-svg-icon" aria-hidden="true"><path d="M14 4l6 6h-4v5h-4v-5H8l6-6zm-7 9h2v7h8v-7h2v9H7v-9z"/></svg>
    </button>
  </div>
</template>
