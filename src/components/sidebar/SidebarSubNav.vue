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
  }
})

const subCategories = computed(() => {
  if (props.activeCategory === 'Geluid') {
    return ['Alle', 'Natuur', 'Instrumentaal', 'Overig']
  }

  if (props.activeCategory === 'Kleuren') {
    return ['Paletten', 'Neutraal', 'Aarde', 'Koel']
  }

  if (props.activeCategory === 'Kamer') {
    return ['Alle', 'Persoonlijk', 'Decoratie']
  }

  return ['Sofa\'s', 'Persoonlijk', 'Meubels', 'Decoratie']
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
