<script setup>
import { computed } from 'vue'

defineEmits(['update:activeSubCategory', 'back'])

const props = defineProps({
  activeCategory: {
    type: String,
    required: true
  },
  activeSubCategory: {
    type: String,
    required: true
  },
  allowedSubCategories: {
    type: Array,
    default: () => []
  }
})

const subCategories = computed(() => {
  if (Array.isArray(props.allowedSubCategories) && props.allowedSubCategories.length) {
    return props.allowedSubCategories
  }

  if (props.activeCategory === 'Geluid') {
    return ['Alle', 'Natuur', 'Instrumentaal', 'Overig']
  }

  if (props.activeCategory === 'Kamer') {
    return ['Muren', 'Vloer']
  }

  return ['Alle', 'Zetel', 'Lamp', 'Tafel', 'Kast', 'Decoratie klein', 'Decoratie groot', 'Persoonlijk', 'Media']
})

</script>

<style scoped>
.editor-sub-nav {
  height: auto;
  min-height: 620px;
  max-height: 620px;
  overflow-y: auto;
  padding-right: 4px;
}
</style>

<template>
  <section class="editor-sub-nav">
    <div class="editor-sub-nav-top">
      <button type="button" class="editor-back-btn" @click="$emit('back')" aria-label="Terug">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
      <span>terug</span>
      </button>
    </div>
    <div class="editor-sub-title">{{ activeCategory }}</div>
    <div class="editor-sub-list">
      <button
        v-for="sub in subCategories"
        :key="sub"
        class="editor-sub-item"
        :class="{ active: activeSubCategory === sub }"
        @click="$emit('update:activeSubCategory', sub)"
      >
        {{ sub }}
      </button>
    </div>
  </section>
</template>
