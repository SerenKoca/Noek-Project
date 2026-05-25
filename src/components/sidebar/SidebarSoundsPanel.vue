<script setup>
import { computed, onMounted, ref } from 'vue'
import { getSoundLibrary } from '../../services/soundLibraryService'

const props = defineProps({
  activeSubCategory: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['select-sound', 'close'])

const loading = ref(false)
const error = ref('')
const sounds = ref([])

const filteredSounds = computed(() => {
  if (props.activeSubCategory === 'Alle') return sounds.value
  return sounds.value.filter((item) => item.category === props.activeSubCategory)
})

async function loadSoundLibrary() {
  loading.value = true
  error.value = ''

  const res = await getSoundLibrary()
  sounds.value = Array.isArray(res.sounds) ? res.sounds : []
  error.value = res.error || ''

  loading.value = false
}

onMounted(() => {
  loadSoundLibrary()
})
</script>

<template>
  <section class="editor-models-panel">
    <div class="editor-models-header">
      <button type="button" class="editor-mini-btn" :disabled="loading" @click="loadSoundLibrary">r</button>
      <button
        type="button"
        class="editor-mini-btn editor-close-btn"
        @pointerdown.stop.prevent="$emit('close')"
        @click.stop.prevent="$emit('close')"
        aria-label="Sluiten"
        title="Sluiten"
      >
        ×
      </button>
    </div>

    <div class="editor-quick-actions">
      <button type="button" class="editor-action-btn" @click="loadSoundLibrary">Herladen</button>
    </div>

    <div v-if="error" class="editor-inline-error">
      {{ error }}
    </div>

    <div v-if="loading" class="editor-loading">Loading...</div>

    <ul v-else class="editor-sound-list">
      <li v-for="sound in filteredSounds" :key="sound.id" class="editor-sound-item">
        <div class="editor-sound-meta">
          <strong>{{ sound.title }}</strong>
          <span>{{ sound.category }}</span>
        </div>
        <button type="button" class="editor-action-btn" @click="emit('select-sound', sound)">Gebruik</button>
      </li>
      <li v-if="!filteredSounds.length" class="editor-loading">Geen geluiden in deze categorie.</li>
    </ul>
  </section>
</template>
