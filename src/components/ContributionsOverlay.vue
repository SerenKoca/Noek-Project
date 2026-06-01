<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import ReactionIcon from './ReactionIcon.vue'
import { addRoomContributionComment, getRoomContributions, reactToRoomContribution } from '../services/roomService.js'

const props = defineProps({ roomId: { type: String, default: '' } })
const emit = defineEmits(['close'])

const CATEGORY_DEFS = [
  { key: 'photos', label: "Foto's" },
  { key: 'videos', label: "Video's" },
  { key: 'music', label: 'Muziek' },
  { key: 'candles', label: 'Kaarsjes' },
  { key: 'reactions', label: 'Reacties' }
]

let previousBodyOverflow = ''
const loading = ref(false)
const loadError = ref('')
const allItems = ref([])
const activeCategory = ref('photos')
const activeIndex = ref(0)
const commentDraft = ref('')
const commentState = ref({ loading: false, error: '' })

const filteredItems = computed(() => {
  const items = Array.isArray(allItems.value) ? allItems.value : []
  if (activeCategory.value === 'photos') return items.filter((item) => item.type === 'photo')
  if (activeCategory.value === 'videos') return items.filter((item) => item.type === 'video_file' || item.type === 'video_url')
  if (activeCategory.value === 'music') return items.filter((item) => item.type === 'music_url')
  if (activeCategory.value === 'candles') return items.filter((item) => item.type === 'candle')
  if (activeCategory.value === 'reactions') {
    return items.filter((item) => {
      const reactions = item?.reactions || {}
      const reactionTotal = Number(reactions.heartCount || 0) + Number(reactions.supportCount || 0) + Number(reactions.candleCount || 0)
      return reactionTotal > 0 || (item?.comments || []).length > 0
    })
  }
  return items
})

const currentItem = computed(() => filteredItems.value[activeIndex.value] || null)

const categoryCounts = computed(() => {
  const items = Array.isArray(allItems.value) ? allItems.value : []
  const counts = {
    photos: 0,
    videos: 0,
    music: 0,
    candles: 0,
    reactions: 0
  }

  for (const item of items) {
    if (item.type === 'photo') counts.photos += 1
    if (item.type === 'video_file' || item.type === 'video_url') counts.videos += 1
    if (item.type === 'music_url') counts.music += 1
    if (item.type === 'candle') counts.candles += 1

    const reactions = item?.reactions || {}
    const reactionTotal = Number(reactions.heartCount || 0) + Number(reactions.supportCount || 0) + Number(reactions.candleCount || 0)
    if (reactionTotal > 0 || (item?.comments || []).length > 0) counts.reactions += 1
  }

  return counts
})

const canGoNext = computed(() => activeIndex.value < filteredItems.value.length - 1)

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('nl-BE', {
    day: '2-digit',
    month: '2-digit'
  })
}

function previewImage(item) {
  if (!item) return ''
  if (item.type === 'photo') return String(item.mediaUrl || '').trim()
  if (item.type === 'video_file') return ''
  if (item.type === 'video_url') return ''
  if (item.type === 'music_url') return ''
  return ''
}

function itemTitle(item) {
  if (!item) return ''
  const baseByType = {
    photo: 'Foto',
    video_file: 'Video',
    video_url: 'Video',
    music_url: 'Muziek',
    candle: 'Kaarsje'
  }
  const base = baseByType[item.type] || 'Bijdrage'
  const giver = String(item.giverName || '').trim()
  return giver ? `${base} van ${giver}` : base
}

function itemSubtitle(item) {
  const text = String(item?.tributeText || '').trim()
  return text || 'Geen boodschap toegevoegd.'
}

function replaceItem(nextItem) {
  if (!nextItem?._id) return
  allItems.value = (allItems.value || []).map((row) => (row._id === nextItem._id ? nextItem : row))
}

async function loadContributions() {
  if (!props.roomId) {
    allItems.value = []
    return
  }

  loading.value = true
  loadError.value = ''

  try {
    const data = await getRoomContributions(props.roomId, { skipLoader: true })
    allItems.value = Array.isArray(data) ? data : []
  } catch (error) {
    allItems.value = []
    loadError.value = error?.response?.data?.error || 'Bijdragen konden niet worden geladen.'
  } finally {
    loading.value = false
    activeIndex.value = 0
  }
}

function close() { emit('close') }

function next() {
  if (!canGoNext.value) return
  activeIndex.value += 1
}

function select(index) {
  if (index < 0 || index >= filteredItems.value.length) return
  activeIndex.value = index
}

function selectCategory(categoryKey) {
  activeCategory.value = categoryKey
  activeIndex.value = 0
  commentDraft.value = ''
  commentState.value = { loading: false, error: '' }
}

async function react(kind) {
  if (!props.roomId || !currentItem.value?._id) return
  try {
    const updated = await reactToRoomContribution(props.roomId, currentItem.value._id, kind)
    replaceItem(updated)
  } catch {
    // keep current view stable on error
  }
}

async function submitComment() {
  const text = String(commentDraft.value || '').trim()
  if (!text || !props.roomId || !currentItem.value?._id) return

  commentState.value = { loading: true, error: '' }
  try {
    const updated = await addRoomContributionComment(props.roomId, currentItem.value._id, {
      text,
      displayName: 'Editor'
    })
    replaceItem(updated)
    commentDraft.value = ''
    commentState.value = { loading: false, error: '' }
  } catch (error) {
    commentState.value = {
      loading: false,
      error: error?.response?.data?.error || 'Commentaar opslaan mislukt.'
    }
  }
}

watch(() => props.roomId, () => {
  loadContributions()
}, { immediate: true })

watch(filteredItems, (items) => {
  if (!items.length) {
    activeIndex.value = 0
    return
  }
  if (activeIndex.value > items.length - 1) activeIndex.value = items.length - 1
})

onMounted(() => {
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  document.body.style.overflow = previousBodyOverflow || ''
})
</script>

<template>
  <div class="overlay" @click.self="close">
    <div class="modal" role="dialog" aria-modal="true">
      <button class="close-btn" type="button" @click="close" aria-label="Sluiten">
        <svg viewBox="0 0 24 24" class="close-icon" aria-hidden="true">
          <path d="M6 6 L18 18" />
          <path d="M18 6 L6 18" />
        </svg>
      </button>

      <div class="modal-body">
        <aside class="left-col">
          <div class="tabs">
            <button
              v-for="category in CATEGORY_DEFS"
              :key="category.key"
              class="tab"
              :class="{ active: category.key === activeCategory }"
              type="button"
              @click="selectCategory(category.key)"
            >
              <span>{{ category.label }}</span>
              <span class="tab-count">{{ categoryCounts[category.key] || 0 }}</span>
            </button>
          </div>

          <div class="list">
            <div v-if="loading" class="list-state">Laden...</div>
            <div v-else-if="loadError" class="list-state is-error">{{ loadError }}</div>
            <div v-else-if="!filteredItems.length" class="list-state">Geen bijdrages in deze categorie.</div>
            <div
              v-for="(c, i) in filteredItems"
              v-else
              :key="c._id || i"
              class="list-item"
              :class="{ active: i === activeIndex }"
              @click="select(i)"
            >
              <div class="thumb-wrap" :class="`is-${c.type}`">
                <img v-if="previewImage(c)" :src="previewImage(c)" class="thumb" alt="thumb" />
                <span v-else class="thumb-label">{{ c.type === 'music_url' ? 'M' : c.type === 'candle' ? 'K' : 'V' }}</span>
              </div>
              <div class="meta">
                <div class="title">{{ itemTitle(c) }}</div>
                <div class="sub">{{ itemSubtitle(c) }}</div>
              </div>
              <div class="date">{{ formatDate(c.createdAt) }}</div>
            </div>
          </div>
        </aside>

        <div class="center-col">
          <div class="card" v-if="currentItem">
            <div class="card-title">{{ itemTitle(currentItem) }}</div>
            <label class="card-label">Hun boodschap:</label>
            <div class="message">{{ itemSubtitle(currentItem) }}</div>

            <div class="card-footer">
              <div class="icons">
                <button type="button" class="icon" @click="react('heart')"><ReactionIcon kind="heart" :size="28" /> <span class="count">{{ currentItem.reactions?.heartCount || 0 }}</span></button>
                <button type="button" class="icon" @click="react('support')"><ReactionIcon kind="support" :size="28" /> <span class="count">{{ currentItem.reactions?.supportCount || 0 }}</span></button>
                <button type="button" class="icon" @click="react('candle')"><ReactionIcon kind="candle" :size="28" /> <span class="count">{{ currentItem.reactions?.candleCount || 0 }}</span></button>
              </div>
              <button class="chat-btn" type="button" @click="activeCategory = 'reactions'">Reacties</button>
            </div>

            <div class="comment-box">
              <input
                v-model="commentDraft"
                type="text"
                placeholder="Plaats een reactie"
                :disabled="commentState.loading"
                @keydown.enter.prevent="submitComment"
              />
              <button type="button" :disabled="commentState.loading" @click="submitComment">Plaats</button>
            </div>
            <p v-if="commentState.error" class="comment-error">{{ commentState.error }}</p>
            <ul v-if="(currentItem.comments || []).length" class="comments-list">
              <li v-for="comment in currentItem.comments" :key="comment._id || comment.createdAt">
                <strong>{{ comment.displayName || 'Gebruiker' }}:</strong>
                <span>{{ comment.text }}</span>
              </li>
            </ul>
          </div>
          <div class="card is-empty" v-else>
            <div class="card-title">Geen bijdrage geselecteerd</div>
            <p class="sub">Selecteer links een item om details te bekijken.</p>
          </div>
        </div>

        <div class="right-col" v-if="currentItem">
          <div class="image-wrap" :class="`is-${currentItem.type}`">
            <img v-if="previewImage(currentItem)" :src="previewImage(currentItem)" alt="grote foto" />
            <div v-else class="image-fallback">
              <div class="image-fallback-title">{{ currentItem.type === 'music_url' ? 'Muziek' : currentItem.type === 'candle' ? 'Kaarsje' : 'Video' }}</div>
              <div class="image-fallback-sub">{{ itemTitle(currentItem) }}</div>
            </div>
          </div>
        </div>

        <button class="nav next" type="button" :disabled="!canGoNext" @click="next" aria-label="Volgende bijdrage">
          <svg viewBox="0 0 24 24" aria-hidden="true" class="nav-chevron">
            <path d="M8 4 L16 12 L8 20" />
          </svg>
        </button>
      </div>

      <div class="delete-wrap">
        <button class="delete-btn" type="button" aria-label="Verwijderen">
          <svg viewBox="0 0 24 24" class="delete-icon" aria-hidden="true">
            <path d="M9 4h6l1 2h3v2H5V6h3l1-2Zm-1 6h2v8H8v-8Zm6 0h2v8h-2v-8ZM7 8h10v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8Z" />
          </svg>
        </button>
        <span class="delete-label">verwijderen</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background: rgba(10, 20, 30, 0.62); z-index:9999; -webkit-font-smoothing:antialiased; padding:20px }
.modal { position:relative; width:min(1220px, 100%); min-height:min(760px, calc(100vh - 40px)); background:#ffffff; border-radius:20px; padding:26px 26px 84px; box-shadow:0 18px 40px rgba(0,0,0,0.25); overflow:hidden }
.close-btn {
  position:absolute;
  right:22px;
  top:18px;
  width:74px;
  height:74px;
  border-radius:26px;
  border:0;
  background:#d7e3ef;
  box-shadow:0 8px 16px rgba(0, 0, 0, 0.16);
  cursor:pointer;
  display:grid;
  place-items:center;
}
.close-btn:hover {
  filter: brightness(0.98);
}
.close-icon {
  width:38px;
  height:38px;
}
.close-icon path {
  fill:none;
  stroke:#0b4f86;
  stroke-width:2.6;
  stroke-linecap:round;
}
.modal-body { display:grid; grid-template-columns: 280px 360px minmax(280px, 1fr); gap:26px; align-items:center; padding-top:6px; min-height:620px }

.left-col {
  padding:4px 8px 0 0;
  border-right:1px solid #dce9f4;
  align-self:stretch;
  display:flex;
  flex-direction:column;
  justify-content:flex-start;
}
.tabs { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:10px; margin-bottom:14px }
.tab { background:#e8f2fb; color:#0b3f72; border:0; padding:10px 12px; border-radius:10px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:8px; min-height:42px }
.tab.active { background:linear-gradient(180deg,#0e4e84,#0b3f72); color:#fff; box-shadow:inset 0 -2px 0 rgba(255,255,255,0.2) }
.tab-count { font-size:0.75rem; border-radius:999px; padding:2px 6px; background:rgba(255,255,255,0.85); color:#0b3f72 }
.tab.active .tab-count { background:rgba(255,255,255,0.22); color:#fff }
.list { max-height:540px; overflow:auto; padding-right:10px }
.list-item { display:flex; align-items:center; gap:12px; padding:10px; border-radius:12px; background:transparent; cursor:pointer; border:1px solid transparent; margin-bottom:10px; min-height:84px }
.list-item.active { background:#eef8ff; border-color:rgba(11,63,116,0.06) }
.thumb-wrap { width:64px; height:64px; border-radius:10px; overflow:hidden; display:grid; place-items:center; background:#dfefff; flex-shrink:0 }
.thumb-wrap.is-music_url { background:#e7f4ff }
.thumb-wrap.is-candle { background:#fff2d9 }
.thumb-wrap.is-video_file,
.thumb-wrap.is-video_url { background:#e7eef7 }
.thumb { width:100%; height:100%; object-fit:cover }
.thumb-label { font-size:1.1rem; color:#0b3f72; font-weight:700 }
.meta { flex:1; min-width:0 }
.title { font-weight:700; color:#0b3f72; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.sub { font-size:0.9rem; color:#345; display:-webkit-box; line-clamp:2; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden }
.date { font-size:0.85rem; color:#5a6b7a }
.list-state { padding:14px 10px; color:#48627d; font-size:0.92rem }
.list-state.is-error { color:#9f1d1d }

.center-col { display:flex; align-items:flex-start; justify-content:center; align-self:center; transform:translateY(24px) }
.card { width:100%; background:#f2fbff; border-radius:14px; padding:18px; box-shadow:0 6px 18px rgba(11,63,116,0.04); min-height:540px; display:flex; flex-direction:column }
.card.is-empty { display:grid; place-content:center; text-align:center }
.card-title { font-size:2rem; line-height:1.1; font-weight:800; color:#0b3f72; margin-bottom:10px }
.card-label { display:block; font-weight:700; color:#0b3f72; margin-bottom:8px }
.message { background:#fff; min-height:140px; border-radius:10px; padding:12px; color:#123; box-shadow:inset 0 1px 0 rgba(0,0,0,0.02) }
.card-footer { display:flex; justify-content:space-between; align-items:center; margin-top:12px }
.icons { display:flex; gap:8px; flex-wrap:wrap }
.icon { background:#fff; padding:8px 10px; border-radius:8px; display:flex; align-items:center; gap:6px; box-shadow:0 6px 12px rgba(11,63,116,0.06); border:0; cursor:pointer; color:#0b3f72; font-weight:600 }
.count { background:#0b3f72; color:#fff; border-radius:999px; padding:2px 6px; margin-left:6px; font-size:0.85rem }
.chat-btn { background:#0b3f72; color:#fff; border:0; padding:10px 14px; border-radius:10px; cursor:pointer }
.comment-box { margin-top:12px; display:grid; grid-template-columns:1fr auto; gap:8px }
.comment-box input { border:1px solid #d7e6f3; border-radius:8px; padding:10px 12px; color:#0d2d49 }
.comment-box button { border:0; border-radius:8px; background:#0b3f72; color:#fff; padding:0 14px; cursor:pointer }
.comment-error { color:#9f1d1d; margin:8px 0 0; font-size:0.86rem }
.comments-list { margin:12px 0 0; padding-left:18px; color:#234; font-size:0.88rem; max-height:150px; overflow:auto }

.right-col { display:flex; align-items:center; justify-content:center; align-self:center; transform:translateY(24px) }
.image-wrap { width:min(100%, 360px); height:540px; border-radius:14px; overflow:hidden; background:#f6f6f6 }
.image-wrap img { width:100%; height:100%; object-fit:cover }
.image-wrap.is-candle { background:linear-gradient(180deg,#fff2d9,#ffe8be) }
.image-wrap.is-music_url { background:linear-gradient(180deg,#e5f4ff,#d5ebfd) }
.image-wrap.is-video_file,
.image-wrap.is-video_url { background:linear-gradient(180deg,#e7eef7,#d9e3f0) }
.image-fallback { width:100%; height:100%; display:grid; place-content:center; text-align:center; padding:24px }
.image-fallback-title { color:#0b3f72; font-size:1.4rem; font-weight:700; margin-bottom:8px }
.image-fallback-sub { color:#2b4a66; font-size:0.95rem }

.nav { position:absolute; right:20px; top:50%; transform:translateY(-50%); width:64px; height:64px; border:0; background:transparent; box-shadow:none; display:grid; place-items:center; cursor:pointer; padding:0 }
.nav-chevron { width:54px; height:54px }
.nav-chevron path { fill:none; stroke:#0b4f86; stroke-width:3.4; stroke-linecap:round; stroke-linejoin:round }
.nav:disabled { opacity:0.45; cursor:not-allowed }
.delete-wrap {
  position:absolute;
  right:18px;
  bottom:14px;
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:8px;
}

.delete-btn {
  width:72px;
  height:72px;
  border:0;
  border-radius:22px;
  background:#d7e3ef;
  box-shadow:0 8px 16px rgba(0, 0, 0, 0.16);
  display:grid;
  place-items:center;
  cursor:pointer;
}

.delete-btn:hover {
  filter: brightness(0.98);
}

.delete-icon {
  width:28px;
  height:28px;
}

.delete-icon path {
  fill:#0b4f86;
}

.delete-label {
  color:#0b4f86;
  font-size:0.95rem;
  line-height:1;
  font-weight:700;
}

/* scrollbar tweak */
.list::-webkit-scrollbar { width:8px }
.list::-webkit-scrollbar-thumb { background: rgba(11,63,116,0.12); border-radius:999px }

@media (max-width: 1240px) {
  .modal-body { grid-template-columns: 250px minmax(320px, 1fr) 300px; gap:18px; min-height:580px }
  .card-title { font-size:1.65rem }
}

@media (max-width: 1060px) {
  .modal { min-height:auto; padding:18px 18px 76px }
  .modal-body { grid-template-columns: 250px minmax(300px, 1fr); gap:16px; min-height:520px }
  .right-col { display:none }
  .center-col { transform:none }
  .nav { right:18px; top:auto; bottom:22px; transform:none; width:56px; height:56px }
  .nav-chevron { width:48px; height:48px }
  .delete-wrap { right:14px; bottom:12px }
  .delete-btn { width:64px; height:64px; border-radius:20px }
  .delete-icon { width:24px; height:24px }
  .delete-label { font-size:0.88rem }
  .card { min-height:500px }
  .list { max-height:500px }
}

@media (max-width: 760px) {
  .overlay { padding:10px }
  .modal { border-radius:14px; padding:14px 14px 68px }
  .modal-body { grid-template-columns: 1fr; min-height:0; align-items:stretch }
  .left-col { border-right:0; border-bottom:1px solid #dce9f4; padding-bottom:12px }
  .center-col { transform:none }
  .tabs { grid-template-columns: repeat(2, minmax(0, 1fr)) }
  .list { max-height:240px }
  .card { min-height:0 }
  .comment-box { grid-template-columns: 1fr }
  .close-btn { width:42px; height:42px; font-size:1.5rem }
  .nav { width:44px; height:44px }
  .nav-chevron { width:38px; height:38px }
  .delete-wrap { right:10px; bottom:8px }
  .delete-btn { width:54px; height:54px; border-radius:16px }
  .delete-icon { width:20px; height:20px }
  .delete-label { font-size:0.8rem }
}
</style>
