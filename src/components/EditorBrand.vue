<script setup>
defineProps({
  logoUrl: {
    type: String,
    default: ''
  },
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
    <img v-if="logoUrl" :src="logoUrl" alt="Brand logo" class="editor-brand-logo" />
    <div class="editor-brand-name">{{ name }}</div>
    <div class="editor-brand-sub">{{ sub }}</div>
  </div>
</template>

<style scoped>
.editor-brand-logo {
  height: 42px;
  max-width: 210px;
  object-fit: contain;
  display: block;
  margin-left: auto;
  margin-bottom: 6px;
}
</style>
