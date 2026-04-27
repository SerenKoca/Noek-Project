<script setup>
import { computed, ref, watch } from 'vue'
import {
  DEFAULT_FLOOR_TEXTURE_ID,
  DEFAULT_WALL_TEXTURE_ID,
  FLOOR_TEXTURE_PRESETS,
  WALL_TEXTURE_PRESETS,
  normalizeFloorTextureId,
  normalizeWallTextureId
} from '../../services/roomSurfaceTextures.js'

const props = defineProps({
  roomAppearance: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['apply-colors'])

const floorTextureId = ref(DEFAULT_FLOOR_TEXTURE_ID)
const wallTextureId = ref(DEFAULT_WALL_TEXTURE_ID)
const selectedSurface = ref('floor')

const selectedTextureId = computed({
  get() {
    return selectedSurface.value === 'wall' ? wallTextureId.value : floorTextureId.value
  },
  set(value) {
    const normalized = normalizeTextureId(value, selectedSurface.value === 'wall' ? DEFAULT_WALL_TEXTURE_ID : DEFAULT_FLOOR_TEXTURE_ID)
    if (selectedSurface.value === 'wall') {
      wallTextureId.value = normalized
    } else {
      floorTextureId.value = normalized
    }
  }
})

const activePresets = computed(() => (selectedSurface.value === 'wall' ? WALL_TEXTURE_PRESETS : FLOOR_TEXTURE_PRESETS))

watch(
  () => props.roomAppearance,
  (appearance) => {
    floorTextureId.value = normalizeFloorTextureId(appearance?.floorTextureId || DEFAULT_FLOOR_TEXTURE_ID)
    wallTextureId.value = normalizeWallTextureId(appearance?.wallTextureId || DEFAULT_WALL_TEXTURE_ID)
  },
  { immediate: true, deep: true }
)

function normalizeTextureId(value, fallback) {
  const id = String(value || '').trim()
  return id || fallback
}

function emitTextures(nextFloorTextureId, nextWallTextureId) {
  emit('apply-colors', {
    floorTextureId: normalizeFloorTextureId(nextFloorTextureId),
    wallTextureId: normalizeWallTextureId(nextWallTextureId)
  })
}

function selectSurface(surface) {
  selectedSurface.value = surface === 'wall' ? 'wall' : 'floor'
}

function applyPresetTexture(textureId) {
  const normalized = normalizeTextureId(textureId, selectedSurface.value === 'wall' ? DEFAULT_WALL_TEXTURE_ID : DEFAULT_FLOOR_TEXTURE_ID)
  if (selectedSurface.value === 'wall') wallTextureId.value = normalized
  else floorTextureId.value = normalized
  emitTextures(floorTextureId.value, wallTextureId.value)
}
</script>

<template>
  <section class="editor-models-panel editor-colors-panel">
    <div class="editor-color-targets editor-texture-targets">
      <button
        type="button"
        class="editor-sub-item"
        :class="{ active: selectedSurface === 'floor' }"
        @click="selectSurface('floor')"
      >
        Vloer
      </button>
      <button
        type="button"
        class="editor-sub-item"
        :class="{ active: selectedSurface === 'wall' }"
        @click="selectSurface('wall')"
      >
        Muur
      </button>
    </div>

    <div class="editor-texture-header">
      <span>Kies een texture voor {{ selectedSurface === 'wall' ? 'de muur' : 'de vloer' }}</span>
      <p>Elke kaart hieronder is een ander materiaal. Je verandert dus het patroon, niet alleen de kleur.</p>
    </div>

    <div class="editor-texture-grid">
      <button
        v-for="preset in activePresets"
        :key="preset.id"
        type="button"
        class="editor-texture-card"
        :class="{ active: selectedTextureId === preset.id }"
        :style="{ backgroundImage: preset.preview }"
        :title="preset.label"
        @click="applyPresetTexture(preset.id)"
      >
        <span>{{ preset.label }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.editor-texture-header {
  margin: 4px 0 10px;
  color: rgba(255, 248, 239, 0.88);
}

.editor-texture-header span {
  display: block;
  font-weight: 700;
  font-size: 0.92rem;
}

.editor-texture-header p {
  margin: 6px 0 0;
  font-size: 0.8rem;
  line-height: 1.35;
  color: rgba(255, 248, 239, 0.72);
}

.editor-texture-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.editor-texture-card {
  min-height: 84px;
  padding: 10px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06), 0 12px 24px rgba(9, 12, 18, 0.18);
  background-size: cover;
  background-position: center;
  position: relative;
  overflow: hidden;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
  display: flex;
  align-items: end;
  justify-content: start;
}

.editor-texture-card span {
  position: relative;
  z-index: 1;
  padding: 6px 8px;
  border-radius: 10px;
  background: rgba(16, 18, 22, 0.52);
  color: #fff8ef;
  font-size: 0.72rem;
  font-weight: 600;
  text-align: left;
  backdrop-filter: blur(4px);
}

.editor-texture-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.34);
}

.editor-texture-card.active {
  border-color: rgba(255, 240, 214, 0.78);
  box-shadow: inset 0 0 0 1px rgba(255, 240, 214, 0.22), 0 0 0 2px rgba(255, 240, 214, 0.2), 0 12px 28px rgba(9, 12, 18, 0.22);
}
</style>