<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNoekState } from '../composables/useNoekState.js'

const route = useRoute()
const router = useRouter()
const state = useNoekState()

const roomId = computed(() => String(route.params.id || ''))

async function loadSettingsRoomByRoute() {
  await state.bootstrap()
  if (!state.authState.value?.token) {
    await router.replace('/login')
    return
  }

  if (state.rooms.value.length === 0) {
    await state.loadRooms()
  }

  const room = state.getRoomById(roomId.value)
  if (!room) {
    await router.replace('/home')
    return
  }

  await state.openRoomSettings(room)
}

onMounted(loadSettingsRoomByRoute)
watch(roomId, loadSettingsRoomByRoute)

async function goHome() {
  state.showHome()
  await router.push('/home')
}

async function goEditor(room) {
  await state.openEditor(room)
  await router.push(`/rooms/${room._id}/editor`)
}
</script>

<template>
  <div class="editor-page is-home">
    <div class="settings-page-v2" v-if="state.settingsRoom.value">
      <header class="settings-header-v2">
        <button type="button" class="secondary-btn" @click="goHome">Back</button>
        <div class="settings-header-center-v2">
          <div class="settings-step-v2">Stap 2 van 3</div>
          <h2>Instellingen kamer: {{ state.settingsRoom.value.name }}</h2>
        </div>
        <button type="button" class="primary-btn" @click="goEditor(state.settingsRoom.value)">Naar kamer</button>
      </header>

      <section class="settings-content-v2">
        <div class="settings-left-v2">
          <h3>Bijdragen toevoegen</h3>

          <form class="contribution-form" @submit.prevent="state.addCandleContribution(state.settingsRoom.value)">
            <h4>Nieuw kaarsje toevoegen</h4>
            <div class="contribution-giver">Van: <strong>{{ state.autoGiverName.value || '-' }}</strong></div>
            <textarea
              v-model="state.newCandleForm.value.tributeText"
              rows="3"
              placeholder="Klein tekstje (max 150 woorden)"
            />
            <div class="contribution-form-meta">
              <span>{{ state.countWords(state.newCandleForm.value.tributeText) }}/150 woorden</span>
              <button
                type="submit"
                class="primary-btn"
                :disabled="state.contributionCreateState.value.loading || state.countWords(state.newCandleForm.value.tributeText) > 150"
              >
                {{ state.contributionCreateState.value.loading ? 'Opslaan...' : 'Kaarsje toevoegen' }}
              </button>
            </div>
          </form>

          <form class="contribution-form" @submit.prevent="state.addMusicUrlContribution(state.settingsRoom.value)">
            <h4>Muzieklink toevoegen</h4>
            <div class="contribution-giver">Van: <strong>{{ state.autoGiverName.value || '-' }}</strong></div>
            <input
              v-model="state.newMusicUrlForm.value.externalUrl"
              type="url"
              placeholder="YouTube of Spotify URL"
            />
            <div v-if="state.detectedMusicPlatform.value === 'youtube' && state.newMusicUrlForm.value.externalUrl" class="youtube-preview-wrap">
              <iframe
                v-if="state.musicYoutubeEmbedUrl.value"
                class="youtube-preview-frame"
                :src="state.musicYoutubeEmbedUrl.value"
                title="YouTube preview"
                loading="lazy"
                referrerpolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
              />
              <div v-else class="room-contribution-empty error">Geen geldige YouTube-link voor preview.</div>
            </div>
            <div v-if="state.detectedMusicPlatform.value === 'spotify' && state.newMusicUrlForm.value.externalUrl" class="spotify-preview-wrap">
              <iframe
                v-if="state.musicSpotifyEmbedUrl.value"
                class="spotify-preview-frame"
                :src="state.musicSpotifyEmbedUrl.value"
                title="Spotify preview"
                loading="lazy"
                referrerpolicy="strict-origin-when-cross-origin"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              />
              <div v-else class="room-contribution-empty error">Geen geldige Spotify-link voor preview.</div>
            </div>
            <textarea
              v-model="state.newMusicUrlForm.value.tributeText"
              rows="3"
              placeholder="Klein tekstje (max 150 woorden)"
            />
            <div class="contribution-form-meta">
              <span>{{ state.countWords(state.newMusicUrlForm.value.tributeText) }}/150 woorden</span>
              <button
                type="submit"
                class="primary-btn"
                :disabled="state.contributionCreateState.value.loading || state.countWords(state.newMusicUrlForm.value.tributeText) > 150"
              >
                {{ state.contributionCreateState.value.loading ? 'Opslaan...' : 'Muzieklink toevoegen' }}
              </button>
            </div>
          </form>

          <form class="contribution-form" @submit.prevent="state.addPhotoFileContribution(state.settingsRoom.value)">
            <h4>Foto uploaden</h4>
            <input :key="state.photoInputKey.value" type="file" accept="image/*" @change="state.handlePhotoFileChange" />
            <textarea
              v-model="state.newPhotoFileForm.value.tributeText"
              rows="3"
              placeholder="Klein tekstje (max 150 woorden)"
            />
            <div class="contribution-form-meta">
              <span>{{ state.countWords(state.newPhotoFileForm.value.tributeText) }}/150 woorden</span>
              <button type="submit" class="primary-btn" :disabled="state.photoUploadState.value.loading">
                {{ state.photoUploadState.value.loading ? 'Uploaden...' : 'Foto uploaden' }}
              </button>
            </div>
            <div v-if="state.photoUploadState.value.error" class="room-contribution-empty error">{{ state.photoUploadState.value.error }}</div>
          </form>

          <div v-if="state.contributionCreateState.value.error" class="room-contribution-empty error">{{ state.contributionCreateState.value.error }}</div>
          <div v-else-if="state.contributionCreateState.value.success" class="room-contribution-empty success">{{ state.contributionCreateState.value.success }}</div>
        </div>

        <div class="settings-right-v2">
          <h3>Overzicht van alle elementen in deze kamer</h3>

          <div v-if="state.contributionLoadState.value.loadingRoomId === state.settingsRoom.value._id" class="room-contribution-empty">
            Elementen laden...
          </div>
          <div v-else-if="state.contributionLoadState.value.error" class="room-contribution-empty error">
            {{ state.contributionLoadState.value.error }}
          </div>
          <div v-else-if="(state.roomContributions.value[state.settingsRoom.value._id] || []).length === 0" class="room-contribution-empty">
            Nog geen foto's, video's of andere bijdragen toegevoegd.
          </div>
          <ul v-else class="room-contribution-items">
            <li v-for="item in state.roomContributions.value[state.settingsRoom.value._id]" :key="item._id" class="room-contribution-item">
              <div><strong>Type:</strong> {{ item.type }}</div>
              <div><strong>Gever:</strong> {{ item.giverName || '-' }}</div>
              <div><strong>Tekst:</strong> {{ item.tributeText || '-' }}</div>
              <div><strong>Media URL:</strong> {{ item.mediaUrl || '-' }}</div>
              <div><strong>Externe URL:</strong> {{ item.externalUrl || '-' }}</div>
              <div><strong>Platform:</strong> {{ item.platform || 'none' }}</div>

              <div class="item-reactions-row">
                <strong>Reacties:</strong>
                <button
                  type="button"
                  class="reaction-chip"
                  :class="{ active: state.getUserReaction(item) === 'heart' }"
                  @click="state.reactOnContribution(state.settingsRoom.value._id, item._id, 'heart')"
                >
                  ❤️ {{ item.reactions?.heartCount || 0 }}
                </button>
                <button
                  type="button"
                  class="reaction-chip"
                  :class="{ active: state.getUserReaction(item) === 'support' }"
                  @click="state.reactOnContribution(state.settingsRoom.value._id, item._id, 'support')"
                >
                  🤍 {{ item.reactions?.supportCount || 0 }}
                </button>
                <button
                  type="button"
                  class="reaction-chip"
                  :class="{ active: state.getUserReaction(item) === 'candle' }"
                  @click="state.reactOnContribution(state.settingsRoom.value._id, item._id, 'candle')"
                >
                  🕯️ {{ item.reactions?.candleCount || 0 }}
                </button>
              </div>

              <form class="item-comment-form" @submit.prevent="state.submitContributionComment(state.settingsRoom.value._id, item._id)">
                <input
                  v-model="state.commentDrafts.value[item._id]"
                  type="text"
                  maxlength="500"
                  placeholder="Laat een reactie achter..."
                />
                <button type="submit" class="secondary-btn" :disabled="state.commentStateByItem.value[item._id]?.loading">
                  {{ state.commentStateByItem.value[item._id]?.loading ? 'Bezig...' : 'Plaats reactie' }}
                </button>
              </form>

              <div v-if="state.commentStateByItem.value[item._id]?.error" class="room-contribution-empty error">
                {{ state.commentStateByItem.value[item._id].error }}
              </div>

              <div class="item-comments-list">
                <strong>Comments ({{ item.comments?.length || 0 }}):</strong>
                <div v-if="!item.comments?.length" class="room-contribution-empty">Nog geen comments.</div>
                <ul v-else class="item-comments-items">
                  <li v-for="comment in item.comments" :key="comment._id || comment.createdAt" class="item-comment-entry">
                    <span class="item-comment-author">{{ comment.displayName || 'Gebruiker' }}:</span>
                    <span>{{ comment.text }}</span>
                  </li>
                </ul>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>

<style src="./styles/settings-page.css"></style>
