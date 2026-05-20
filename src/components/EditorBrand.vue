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
  </div>
</template>

<style scoped>
.editor-brand {
  background: #fff;
  padding: 6px 8px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(0,0,0,0.08);
}

.editor-brand-logo {
  height: 56px;
  width: auto;
  max-width: 220px;
  object-fit: contain;
  display: block;
}
</style>
