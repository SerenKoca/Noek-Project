<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    default: 'Link gekopieerd.'
  }
})
</script>

<template>
  <transition name="copy-toast-fade">
    <div v-if="visible" class="copy-toast-overlay" aria-live="polite" role="status">
      <div class="copy-toast-card">
        <svg viewBox="0 0 24 24" aria-hidden="true" class="copy-toast-icon">
          <path d="M9 16.2 4.8 12l-1.4 1.4L9 19.2 20.6 7.6l-1.4-1.4z" />
        </svg>
        <span>{{ message }}</span>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.copy-toast-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 24px;
  pointer-events: none;
  z-index: 3000;
}

.copy-toast-card {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-radius: 999px;
  background: rgba(20, 33, 48, 0.96);
  color: #fff;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.24);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.01em;
  max-width: min(92vw, 420px);
}

.copy-toast-icon {
  width: 18px;
  height: 18px;
  fill: currentColor;
  flex: 0 0 auto;
}

.copy-toast-fade-enter-active,
.copy-toast-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.copy-toast-fade-enter-from,
.copy-toast-fade-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
</style>