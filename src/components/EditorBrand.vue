<script setup>
defineProps({
  name: {
    type: String,
    default: 'Thibaut DELA'
  },
  sub: {
    type: String,
    default: 'Uitvaartzorg'
  }
})
</script>

<template>
  <div class="editor-brand">
    <div class="editor-brand-name">{{ name }}</div>
    <div class="editor-brand-sub">{{ sub }}</div>
  </div>
</template>
