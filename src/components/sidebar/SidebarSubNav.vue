<script setup>
import { computed } from 'vue'

defineEmits(['update:activeSubCategory'])

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

  if (props.activeCategory === 'Kleuren') {
    return ['Paletten', 'Neutraal', 'Aarde', 'Koel']
  }

  return ['Alle', 'Zetel', 'Lamp', 'Tafel', 'Kast', 'Decoratie klein', 'Decoratie groot', 'Persoonlijk', 'Media']
})
</script>

<template>
  <section class="editor-sub-nav">
    <div class="editor-sub-header">back</div>
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
