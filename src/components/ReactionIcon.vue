<script setup>
import { computed } from 'vue'

const props = defineProps({
  kind: {
    type: String,
    required: true
  },
  size: {
    type: [Number, String],
    default: 28
  },
  className: {
    type: String,
    default: ''
  }
})

const ICONS = {
  heart: '/img/icon-reaction/icon_hart.svg',
  support: '/img/icon-reaction/icon_hug.svg',
  candle: '/img/icon-reaction/icon_sad.svg'
}

const iconSrc = computed(() => ICONS[String(props.kind || '').trim()] || ICONS.heart)
const iconSize = computed(() => `${Number(props.size) || 28}px`)
</script>

<template>
  <img
    :src="iconSrc"
    :alt="kind"
    :class="['reaction-icon', className]"
    :style="{ width: iconSize, height: iconSize }"
  />
</template>

<style scoped>
.reaction-icon {
  display: inline-block;
  vertical-align: middle;
  object-fit: contain;
  flex: 0 0 auto;
}
</style>