<script setup>
import { computed, ref, watch } from 'vue'
import {
  DEFAULT_FLOOR_TEXTURE_ID,
  DEFAULT_WALL_TEXTURE_ID,
  FLOOR_TEXTURE_PRESETS,
  getFloorTextureDefaults,
  getWallTextureDefaults,
  WALL_TEXTURE_PRESETS,
  normalizeFloorTextureId,
  normalizeSurfaceTextureColors,
  normalizeWallTextureId
} from '../../services/roomSurfaceTextures.js'

const props = defineProps({
  activeSubCategory: {
    type: String,
    default: 'Vloer'
  },
  roomAppearance: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['apply-colors', 'close'])

const floorTextureId = ref(DEFAULT_FLOOR_TEXTURE_ID)
const wallTextureId = ref(DEFAULT_WALL_TEXTURE_ID)
const floorTextureColorsById = ref({})
const wallTextureColorsById = ref({})

const selectedSurface = computed(() => {
  const subCategory = String(props.activeSubCategory || '').toLowerCase()
  return subCategory === 'muren' || subCategory === 'muur' ? 'wall' : 'floor'
})

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
const selectedTextureColors = computed(() => {
  const textureId = selectedTextureId.value
  const map = selectedSurface.value === 'wall' ? wallTextureColorsById.value : floorTextureColorsById.value
  const defaults = selectedSurface.value === 'wall' ? getWallTextureDefaults(textureId) : getFloorTextureDefaults(textureId)
  return normalizeSurfaceTextureColors(selectedSurface.value, textureId, map?.[textureId] || defaults)
})

watch(
  () => props.roomAppearance,
  (appearance) => {
    floorTextureId.value = normalizeFloorTextureId(appearance?.floorTextureId || DEFAULT_FLOOR_TEXTURE_ID)
    wallTextureId.value = normalizeWallTextureId(appearance?.wallTextureId || DEFAULT_WALL_TEXTURE_ID)
    floorTextureColorsById.value = normalizeTextureColorMap('floor', appearance?.floorTextureColorsById || appearance?.floorTextureColors || {})
    wallTextureColorsById.value = normalizeTextureColorMap('wall', appearance?.wallTextureColorsById || appearance?.wallTextureColors || {})
  },
  { immediate: true, deep: true }
)

function normalizeTextureId(value, fallback) {
  const id = String(value || '').trim()
  return id || fallback
}

function normalizeTextureColorMap(surface, value = {}) {
  const out = {}
  for (const [textureId, colors] of Object.entries(value || {})) {
    out[textureId] = normalizeSurfaceTextureColors(surface, textureId, colors)
  }
  return out
}

function ensureTexturePalette(surface, textureId) {
  if (surface === 'wall') {
    const map = { ...wallTextureColorsById.value }
    if (!map[textureId]) {
      map[textureId] = normalizeSurfaceTextureColors('wall', textureId, getWallTextureDefaults(textureId))
      wallTextureColorsById.value = map
    }
    return map[textureId]
  }

  const map = { ...floorTextureColorsById.value }
  if (!map[textureId]) {
    map[textureId] = normalizeSurfaceTextureColors('floor', textureId, getFloorTextureDefaults(textureId))
    floorTextureColorsById.value = map
  }
  return map[textureId]
}

function emitTextures(nextFloorTextureId, nextWallTextureId) {
  const floorPalette = normalizeSurfaceTextureColors('floor', nextFloorTextureId, floorTextureColorsById.value?.[nextFloorTextureId] || getFloorTextureDefaults(nextFloorTextureId))
  const wallPalette = normalizeSurfaceTextureColors('wall', nextWallTextureId, wallTextureColorsById.value?.[nextWallTextureId] || getWallTextureDefaults(nextWallTextureId))

  emit('apply-colors', {
    floorTextureId: normalizeFloorTextureId(nextFloorTextureId),
    wallTextureId: normalizeWallTextureId(nextWallTextureId),
    floorColor: floorPalette.primaryColor,
    wallColor: wallPalette.primaryColor,
    floorAccentColor: floorPalette.secondaryColor,
    wallAccentColor: wallPalette.secondaryColor,
    floorTextureColorsById: normalizeTextureColorMap('floor', floorTextureColorsById.value),
    wallTextureColorsById: normalizeTextureColorMap('wall', wallTextureColorsById.value)
  })
}

function applyPresetTexture(textureId) {
  const normalized = normalizeTextureId(textureId, selectedSurface.value === 'wall' ? DEFAULT_WALL_TEXTURE_ID : DEFAULT_FLOOR_TEXTURE_ID)
  if (selectedSurface.value === 'wall') wallTextureId.value = normalized
  else floorTextureId.value = normalized
  ensureTexturePalette(selectedSurface.value, normalized)
  emitTextures(floorTextureId.value, wallTextureId.value)
}

function updateSelectedTextureColor(field, value) {
  const textureId = selectedTextureId.value
  const surface = selectedSurface.value
  const nextPalette = normalizeSurfaceTextureColors(surface, textureId, {
    ...ensureTexturePalette(surface, textureId),
    [field]: value
  })

  if (surface === 'wall') {
    wallTextureColorsById.value = {
      ...wallTextureColorsById.value,
      [textureId]: nextPalette
    }
  } else {
    floorTextureColorsById.value = {
      ...floorTextureColorsById.value,
      [textureId]: nextPalette
    }
  }

  emitTextures(floorTextureId.value, wallTextureId.value)
}

function resetSelectedTextureColors() {
  const textureId = selectedTextureId.value
  const surface = selectedSurface.value
  const palette = surface === 'wall'
    ? normalizeSurfaceTextureColors('wall', textureId, getWallTextureDefaults(textureId))
    : normalizeSurfaceTextureColors('floor', textureId, getFloorTextureDefaults(textureId))

  if (surface === 'wall') {
    wallTextureColorsById.value = {
      ...wallTextureColorsById.value,
      [textureId]: palette
    }
  } else {
    floorTextureColorsById.value = {
      ...floorTextureColorsById.value,
      [textureId]: palette
    }
  }

  emitTextures(floorTextureId.value, wallTextureId.value)
}
</script>

<template>
  <section class="editor-models-panel editor-colors-panel">
    <div class="editor-models-header">
      <button type="button" class="editor-mini-btn editor-close-btn" @click.stop="$emit('close')" aria-label="Sluiten">x</button>
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

    <div class="editor-texture-colors">
      <div class="editor-texture-color-row">
        <label>
          <span>Hoofdkleur</span>
          <input
            :value="selectedTextureColors.primaryColor"
            type="color"
            @input="updateSelectedTextureColor('primaryColor', $event.target.value)"
          />
        </label>
        <label>
          <span>Accentkleur</span>
          <input
            :value="selectedTextureColors.secondaryColor"
            type="color"
            @input="updateSelectedTextureColor('secondaryColor', $event.target.value)"
          />
        </label>
      </div>

      <button type="button" class="editor-texture-reset-btn" @click="resetSelectedTextureColors">
        Herstel standaardkleuren voor deze textuur
      </button>
    </div>
  </section>
</template>

<style scoped>
.editor-texture-header {
  position: sticky;
  top: 0;
  z-index: 2;
  margin: 4px 0 10px;
  padding: 8px 0 10px;
  background: linear-gradient(180deg, color-mix(in srgb, white 88%, var(--editor-panel) 12%), color-mix(in srgb, white 82%, var(--editor-panel-soft) 18%));
  color: rgba(7, 38, 72, 0.92);
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
  color: rgba(7, 38, 72, 0.68);
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

.editor-texture-targets .editor-sub-item {
  color: rgba(7, 38, 72, 0.95);
}

.editor-texture-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.34);
}

.editor-texture-card.active {
  border-color: rgba(255, 240, 214, 0.78);
  box-shadow: inset 0 0 0 1px rgba(255, 240, 214, 0.22), 0 0 0 2px rgba(255, 240, 214, 0.2), 0 12px 28px rgba(9, 12, 18, 0.22);
}

.editor-texture-colors {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(7, 38, 72, 0.12);
}

.editor-texture-color-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.editor-texture-color-row label {
  display: grid;
  gap: 6px;
  font-size: 0.78rem;
  color: rgba(7, 38, 72, 0.82);
  font-weight: 600;
}

.editor-texture-color-row input[type='color'] {
  width: 100%;
  min-height: 42px;
  border: 1px solid rgba(7, 38, 72, 0.16);
  border-radius: 12px;
  background: transparent;
  padding: 4px;
}

.editor-texture-reset-btn {
  width: 100%;
  margin-top: 10px;
  border: 1px solid rgba(7, 38, 72, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.52);
  color: rgba(7, 38, 72, 0.92);
  font-weight: 600;
  padding: 10px 12px;
}

.editor-colors-panel {
  height: auto;
  min-height: 620px;
  max-height: 620px;
  overflow-y: auto;
  padding-right: 4px;
}
</style>