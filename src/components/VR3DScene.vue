<script setup>
import { ref } from 'vue'
import ThreeScene from './ThreeScene.vue'

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  roomData: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['exit'])
const sceneRef = ref(null)
</script>

<template>
  <div class="vr-wrapper">
    <ThreeScene
      ref="sceneRef"
      :room-data="roomData"
      :vr-mode="true"
      :vr-items="items"
    />
    <button type="button" class="vr-back" @click="() => emit('exit')">
      ← Terug naar galerij
    </button>
  </div>
</template>

<style scoped>
.vr-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.vr-back {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 100;
  padding: 12px 20px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.95);
  color: #0d1820;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.vr-back:hover {
  background: rgba(255, 255, 255, 1);
  transform: translateX(-3px);
}
</style>
