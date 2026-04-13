<script setup>
defineProps({
  activeCategory: {
    type: String,
    required: true
  },
  activeSubCategory: {
    type: String,
    required: true
  }
})

defineEmits(['update:activeSubCategory'])
</script>

<template>
  <section class="editor-sub-nav">
    <div class="editor-sub-header">back</div>
    <div class="editor-sub-title">{{ activeCategory }}</div>
    <div class="editor-sub-list">
      <button class="editor-sub-item" :class="{ active: activeSubCategory === 'Sofa\'s' }" @click="$emit('update:activeSubCategory', 'Sofa\'s')">Sofa's</button>
      <button class="editor-sub-item" :class="{ active: activeSubCategory === 'Persoonlijk' }" @click="$emit('update:activeSubCategory', 'Persoonlijk')">Persoonlijk</button>
      <button class="editor-sub-item" :class="{ active: activeSubCategory === 'Meubels' }" @click="$emit('update:activeSubCategory', 'Meubels')">Meubels</button>
      <button class="editor-sub-item" :class="{ active: activeSubCategory === 'Decoratie' }" @click="$emit('update:activeSubCategory', 'Decoratie')">Decoratie</button>
    </div>
  </section>
</template>
