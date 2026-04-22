<script setup>
import { computed } from 'vue'
import { useGlobalLoadingState } from '../services/globalLoading.js'

const globalLoading = useGlobalLoadingState()
const visible = computed(() => globalLoading.isGlobalLoading.value)
</script>

<template>
  <Transition name="global-loader-fade">
    <div v-if="visible" class="global-loader" role="status" aria-live="polite" aria-label="Laden">
      <div class="global-loader-card">
        <div class="global-loader-candle-scene" aria-hidden="true">
          <div class="global-loader-candle is-large">
            <span class="global-loader-candle-flame"></span>
            <span class="global-loader-candle-wax"></span>
          </div>
          <div class="global-loader-candle is-small">
            <span class="global-loader-candle-flame"></span>
            <span class="global-loader-candle-wax"></span>
          </div>
        </div>

        <p class="global-loader-text">Herinneringen worden geladen ...</p>

        <div class="global-loader-progress" aria-hidden="true">
          <span class="global-loader-progress-knob"></span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.global-loader {
  position: fixed;
  inset: 0;
  z-index: 2200;
  display: grid;
  place-items: center;
  padding: 20px;
  background:
    radial-gradient(130% 95% at 50% 92%, color-mix(in srgb, var(--brand-light, #d7ebff) 86%, white) 0%, rgba(255, 255, 255, 0) 72%),
    linear-gradient(180deg, #f4f5f8 0%, #eceff4 62%, color-mix(in srgb, var(--brand-light, #d7ebff) 38%, white) 100%);
}

.global-loader::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: url('/img/background-element.svg');
  background-repeat: no-repeat;
  background-position: left -80px bottom -60px;
  background-size: min(860px, 64vw);
  opacity: 0.18;
}

.global-loader-card {
  position: relative;
  width: min(680px, 100%);
  border-radius: 16px;
  padding: clamp(24px, 4vw, 34px) clamp(18px, 4vw, 38px);
  display: grid;
  justify-items: center;
  gap: 18px;
  background: color-mix(in srgb, white 83%, var(--brand-light, #d7ebff) 17%);
  border: 1px solid color-mix(in srgb, var(--brand-dark, #0c4f82) 14%, white);
  box-shadow: 0 28px 48px rgba(15, 34, 56, 0.12);
}

.global-loader-candle-scene {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 20px;
  min-height: 148px;
  width: 100%;
  position: relative;
}

.global-loader-candle-scene::before {
  content: '';
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: min(200px, 65%);
  height: 18px;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(34, 52, 70, 0.2) 0%, rgba(34, 52, 70, 0) 72%);
}

.global-loader-candle {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.global-loader-candle-flame {
  position: relative;
  width: 34px;
  height: 50px;
  border-radius: 55% 55% 68% 68% / 72% 72% 42% 42%;
  background: radial-gradient(circle at 52% 24%, #fff2bf 0%, #f6be2c 44%, #d97a06 100%);
  box-shadow:
    0 4px 10px rgba(209, 119, 12, 0.34),
    0 0 16px rgba(246, 177, 43, 0.28);
  transform-origin: 50% 80%;
  animation: global-loader-flame-flicker 2.3s ease-in-out infinite;
}

.global-loader-candle.is-small .global-loader-candle-flame {
  width: 28px;
  height: 42px;
  animation-delay: 0.5s;
}

.global-loader-candle-wax {
  position: relative;
  margin-top: 10px;
  border-radius: 24px 24px 28px 28px;
  background:
    linear-gradient(180deg, #fffdfa 0%, #fff6e7 22%, #fbefd9 64%, #f1e0bf 100%);
  border: 1px solid rgba(219, 192, 146, 0.46);
  box-shadow:
    inset -8px 0 12px rgba(203, 166, 109, 0.25),
    inset 0 7px 10px rgba(255, 255, 255, 0.7),
    0 10px 16px rgba(46, 33, 71, 0.2);
}

.global-loader-candle.is-large .global-loader-candle-wax {
  width: 90px;
  height: 118px;
}

.global-loader-candle.is-small .global-loader-candle-wax {
  width: 66px;
  height: 90px;
}

.global-loader-text {
  margin: 0;
  color: color-mix(in srgb, var(--brand-dark, #0c4f82) 92%, black);
  font-size: clamp(1.18rem, 2.2vw, 2rem);
  font-weight: 700;
  letter-spacing: 0.01em;
  text-align: center;
}

.global-loader-progress {
  width: min(440px, 100%);
  height: 38px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--brand-dark, #0c4f82) 22%, white);
  background: color-mix(in srgb, var(--brand-light, #d7ebff) 64%, white);
  overflow: hidden;
  position: relative;
}

.global-loader-progress-knob {
  position: absolute;
  top: 3px;
  left: 4px;
  width: 34px;
  height: 30px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--brand-dark, #0c4f82), color-mix(in srgb, var(--brand-dark, #0c4f82) 65%, white));
  box-shadow: 0 6px 14px color-mix(in srgb, var(--brand-dark, #0c4f82) 38%, transparent);
  animation: global-loader-progress-slide 1.8s ease-in-out infinite;
}

.global-loader-fade-enter-active,
.global-loader-fade-leave-active {
  transition: opacity 0.24s ease;
}

.global-loader-fade-enter-from,
.global-loader-fade-leave-to {
  opacity: 0;
}

@keyframes global-loader-flame-flicker {
  0% {
    transform: translateX(0) rotate(-2deg) scale(1);
  }

  32% {
    transform: translateX(1px) rotate(2deg) scale(1.05, 0.97);
  }

  61% {
    transform: translateX(-1px) rotate(-1deg) scale(0.97, 1.02);
  }

  100% {
    transform: translateX(0) rotate(-2deg) scale(1);
  }
}

@keyframes global-loader-progress-slide {
  0% {
    left: 4px;
  }

  50% {
    left: calc(100% - 38px);
  }

  100% {
    left: 4px;
  }
}

@media (max-width: 720px) {
  .global-loader-card {
    width: min(680px, calc(100% - 8px));
  }

  .global-loader::before {
    background-position: left -150px bottom -20px;
    background-size: min(710px, 120vw);
  }

  .global-loader-progress {
    height: 34px;
  }

  .global-loader-progress-knob {
    height: 26px;
    width: 30px;
  }
}
</style>
