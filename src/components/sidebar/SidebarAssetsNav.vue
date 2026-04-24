<script setup>
defineProps({
  activeCategory: {
    type: String,
    required: true
  }
})

defineEmits(['update:activeCategory'])
</script>

<template>
  <section class="editor-assets-nav">
    <h2 class="editor-assets-title">Assets</h2>
    <div class="editor-assets-actions">
      <button
        class="editor-assets-btn"
        :class="{ active: activeCategory === 'Meubels' }"
        @click="$emit('update:activeCategory', 'Meubels')"
      >
        <span class="chip-icon">M</span>
        <span>Meubels</span>
      </button>
      <button
        class="editor-assets-btn"
        :class="{ active: activeCategory === 'Geluid' }"
        @click="$emit('update:activeCategory', 'Geluid')"
      >
        <span class="chip-icon">G</span>
        <span>Geluid</span>
      </button>
      <button
        class="editor-assets-btn"
        :class="{ active: activeCategory === 'Kleuren' }"
        @click="$emit('update:activeCategory', 'Kleuren')"
      >
        <span class="chip-icon">C</span>
        <span>Kleuren</span>
      </button>
    </div>
  </section>
</template>
