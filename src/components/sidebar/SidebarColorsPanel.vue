<script setup>
import { computed, ref, watch } from 'vue'

const DEFAULT_FLOOR = '#c0b496'
const DEFAULT_WALL = '#8f98a3'

const PRESET_COLORS = [
  '#f4f1ea',
  '#d5c4a1',
  '#b7b7b7',
  '#9f7d63',
  '#c2ccb3',
  '#7f96ad',
  '#4f6270',
  '#efefef'
]

const props = defineProps({
  roomAppearance: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['apply-colors'])

const floorColor = ref(DEFAULT_FLOOR)
const wallColor = ref(DEFAULT_WALL)
const selectedSurface = ref('floor')

const selectedColor = computed({
  get() {
    return selectedSurface.value === 'wall' ? wallColor.value : floorColor.value
  },
  set(value) {
    const normalized = normalizeColor(value, selectedSurface.value === 'wall' ? DEFAULT_WALL : DEFAULT_FLOOR)
    if (selectedSurface.value === 'wall') {
      wallColor.value = normalized
    } else {
      floorColor.value = normalized
    }
  }
})

watch(
  () => props.roomAppearance,
  (appearance) => {
    floorColor.value = normalizeColor(appearance?.floorColor, DEFAULT_FLOOR)
    wallColor.value = normalizeColor(appearance?.wallColor, DEFAULT_WALL)
  },
  { immediate: true, deep: true }
)

function normalizeColor(value, fallback) {
  const input = String(value || '').trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(input)) return input
  return fallback
}

function emitColors(nextFloorColor, nextWallColor) {
  emit('apply-colors', {
    floorColor: normalizeColor(nextFloorColor, DEFAULT_FLOOR),
    wallColor: normalizeColor(nextWallColor, DEFAULT_WALL)
  })
}

function applyFloorColor() {
  emitColors(floorColor.value, wallColor.value)
}

function applyWallColor() {
  emitColors(floorColor.value, wallColor.value)
}

function selectSurface(surface) {
  selectedSurface.value = surface === 'wall' ? 'wall' : 'floor'
}

function applySelectedColor() {
  if (selectedSurface.value === 'wall') {
    applyWallColor()
    return
  }
  applyFloorColor()
}

function applyPresetColor(hexColor) {
  const normalized = normalizeColor(hexColor, selectedSurface.value === 'wall' ? DEFAULT_WALL : DEFAULT_FLOOR)
  if (selectedSurface.value === 'wall') wallColor.value = normalized
  else floorColor.value = normalized
  emitColors(floorColor.value, wallColor.value)
}
</script>

<template>
  <section class="editor-models-panel editor-colors-panel">
    <div class="editor-color-targets">
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

    <div class="editor-color-picker-row">
      <label>
        <span>Kies kleur voor {{ selectedSurface === 'wall' ? 'muur' : 'vloer' }}</span>
        <input v-model="selectedColor" type="color" @input="applySelectedColor" />
      </label>
    </div>

    <div class="editor-color-swatches">
      <button
        v-for="hex in PRESET_COLORS"
        :key="hex"
        type="button"
        class="editor-color-dot"
        :class="{ active: selectedColor === hex }"
        :style="{ backgroundColor: hex }"
        :title="hex"
        @click="applyPresetColor(hex)"
      />
    </div>
  </section>
</template>