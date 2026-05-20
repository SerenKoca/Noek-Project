<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  roomName: String,
  visitUrl: String,
  directorName: String,
})

const emit = defineEmits(['close'])

const copied = ref(false)

function copyToClipboard() {
  if (props.visitUrl && navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(props.visitUrl)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}

function shareVia(platform) {
  const text = `De Herdenkingsruimte voor ${props.roomName} is nu live`
  const url = props.visitUrl

  if (platform === 'facebook') {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank')
  } else if (platform === 'x') {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank')
  } else if (platform === 'mail') {
    window.location.href = `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`
  }
}

function downloadQR() {
  window.alert('QR code download coming soon')
}
</script>

<template>
  <div class="share-modal-overlay" @click="$emit('close')">
    <div class="share-modal-content" @click.stop>
      <button class="share-modal-close" @click="$emit('close')">✕</button>

      <div class="share-modal-inner">
        <h2 class="share-modal-title">Gelukt!</h2>

        <p class="share-modal-subtitle">
          De Herdenkingsruimte voor <strong>{{ roomName }}</strong> is nu live
        </p>

        <div class="share-modal-main">
          <div class="share-modal-left">
            <div class="share-link-label">Deel de link naar de ruimte:</div>
            <div class="share-link-row">
              <input type="text" class="share-link-input" :value="visitUrl" readonly />
              <button class="share-copy-btn" @click="copyToClipboard" :title="copied ? 'Gekopieerd!' : 'Kopiëren'">
                📋
              </button>
            </div>

            <div class="share-modal-buttons">
              <button class="share-btn facebook" @click="shareVia('facebook')">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                Delen via Facebook
              </button>
              <button class="share-btn x" @click="shareVia('x')">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.207-6.802-5.997 6.802H2.162l7.732-8.835L1.166 2.25h6.837l4.716 6.231 5.43-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Delen via X
              </button>
              <button class="share-btn mail" @click="shareVia('mail')">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                </svg>
                Delen via Mail
              </button>
            </div>
          </div>

          <div class="share-modal-right">
            <div class="share-qr-codes">
              <div class="share-qr-item">
                <div class="share-qr-placeholder">
                  <svg viewBox="0 0 100 100">
                    <rect width="100" height="100" fill="#f0f0f0" />
                    <rect x="10" y="10" width="30" height="30" fill="#000" />
                    <rect x="60" y="10" width="30" height="30" fill="#000" />
                    <rect x="10" y="60" width="30" height="30" fill="#000" />
                    <circle cx="50" cy="50" r="15" fill="#000" opacity="0.3" />
                  </svg>
                </div>
              </div>
            </div>
            <button class="share-download-btn" @click="downloadQR">Download QR Code</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.share-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.share-modal-content {
  background: #e9f2fb;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  max-width: 900px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.share-modal-close {
  position: absolute;
  top: 20px;
  right: 20px;
  background: transparent;
  border: none;
  font-size: 32px;
  cursor: pointer;
  color: #333;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.share-modal-close:hover {
  color: #000;
}

.share-modal-inner {
  padding: 40px;
}

.share-modal-title {
  font-size: 36px;
  font-weight: 700;
  margin: 0 0 20px 0;
  text-align: center;
  color: #1a1a1a;
}

.share-modal-subtitle {
  font-size: 16px;
  text-align: center;
  color: #333;
  margin: 0 0 32px 0;
  line-height: 1.5;
}

.share-modal-subtitle strong {
  font-weight: 600;
}

.share-modal-main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  align-items: start;
}

.share-modal-left {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.share-link-label {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.share-link-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.share-link-input {
  flex: 1;
  padding: 12px 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  font-family: monospace;
  background: #f9f9f9;
  color: #000;
}

.share-copy-btn {
  width: 40px;
  height: 40px;
  background: #0c4f82;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.share-copy-btn:hover {
  background: #0a3d68;
}

.share-modal-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.share-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 18px;
  border: none;
  border-radius: 20px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.share-btn.facebook {
  background: #0c4f82;
  color: white;
}

.share-btn.facebook:hover {
  background: #0a3d68;
}

.share-btn.x {
  background: #0c4f82;
  color: white;
}

.share-btn.x:hover {
  background: #0a3d68;
}

.share-btn.mail {
  background: #0c4f82;
  color: white;
}

.share-btn.mail:hover {
  background: #0a3d68;
}

.share-modal-right {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

.share-qr-codes {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  align-items: center;
}

.share-qr-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.share-qr-placeholder {
  width: 140px;
  height: 140px;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  background: #f9f9f9;
}

.share-qr-placeholder svg {
  width: 100%;
  height: 100%;
}

.share-qr-branding {
  text-align: center;
  color: #0c5a8a;
}

.share-qr-text {
  font-weight: 700;
  font-size: 13px;
}

.share-qr-subtext {
  font-size: 11px;
  color: #999;
}

.share-download-btn {
  padding: 12px 24px;
  background: #0c4f82;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.share-download-btn:hover {
  background: #0a3d68;
}

@media (max-width: 750px) {
  .share-modal-inner {
    padding: 24px;
  }

  .share-modal-title {
    font-size: 28px;
  }

  .share-modal-main {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .share-btn {
    font-size: 13px;
    padding: 10px 16px;
  }
}
</style>
