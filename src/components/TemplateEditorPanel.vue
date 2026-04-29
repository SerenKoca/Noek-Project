<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  sceneRef: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])

// Get template state from scene
const templateEditorSlotId = computed(() => props.sceneRef?.templateEditorSlotId?.value || '')
const templateSlotCategory = computed(() => props.sceneRef?.templateSlotCategory?.value || 'Alle')
const templateDraft = computed(() => props.sceneRef?.templateDraft?.value || {})
const TEMPLATE_SLOT_EDITOR_CATEGORIES = computed(() => props.sceneRef?.TEMPLATE_SLOT_EDITOR_CATEGORIES || [])
const filteredTemplateSlots = computed(() => props.sceneRef?.filteredTemplateSlots?.value || [])
const templateEditorMessage = computed(() => props.sceneRef?.templateEditorMessage?.value || '')

// Methods that delegate to scene
function updateSlotId(newId) {
  if (props.sceneRef?.updateTemplateEditorSlotId) {
    props.sceneRef.updateTemplateEditorSlotId(newId)
  }
}

function updateCategory(cat) {
  if (props.sceneRef?.templateSlotCategory) {
    props.sceneRef.templateSlotCategory.value = cat
  }
}

function updateDraftField(field, value) {
  if (props.sceneRef?.templateDraft) {
    props.sceneRef.templateDraft.value[field] = value
  }
}

function applyDraft() {
  if (props.sceneRef?.applyTemplateDraft) {
    props.sceneRef.applyTemplateDraft()
  }
}

function createSlot() {
  if (props.sceneRef?.createNewTemplateSlot) {
    props.sceneRef.createNewTemplateSlot()
  }
}

function saveLocal() {
  if (props.sceneRef?.saveTemplateToLocalStorage) {
    props.sceneRef.saveTemplateToLocalStorage()
  }
}

function resetDefaults() {
  if (props.sceneRef?.resetTemplateDefaults) {
    props.sceneRef.resetTemplateDefaults()
  }
}

function toggleDrag() {
  if (props.sceneRef?.toggleTemplateDrag) {
    props.sceneRef.toggleTemplateDrag()
  }
}

function setDragMode(mode) {
  if (props.sceneRef?.setTemplateDragMode) {
    props.sceneRef.setTemplateDragMode(mode)
  }
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <div v-if="isOpen" class="template-editor-modal-overlay" @click.self="handleClose">
    <div class="template-editor-modal">
      <div class="template-editor-header">
        <h2>Template Editor</h2>
        <button type="button" class="template-editor-close" @click="handleClose">✕</button>
      </div>

      <div class="template-editor-content">
        <div class="template-editor-section">
          <div class="template-editor-label-row">
            <span>Categorie</span>
            <span class="category-badge">{{ templateSlotCategory }}</span>
          </div>
          <div class="category-buttons">
            <button
              v-for="category in TEMPLATE_SLOT_EDITOR_CATEGORIES"
              :key="category"
              type="button"
              class="category-btn"
              :class="{ active: templateSlotCategory === category }"
              @click="updateCategory(category)"
            >
              {{ category }}
            </button>
          </div>
        </div>

        <div class="template-editor-section">
          <label class="template-editor-label">
            <span>Slot</span>
            <select
              :value="templateEditorSlotId"
              class="template-editor-select"
              @change="(e) => updateSlotId(e.target.value)"
            >
              <option v-for="slot in filteredTemplateSlots" :key="slot.id" :value="slot.id">
                {{ slot.label || slot.id }}
              </option>
            </select>
          </label>
        </div>

        <div class="template-editor-section">
          <span>Slot categorieën</span>
          <div class="slot-categories">
            <label
              v-for="category in TEMPLATE_SLOT_EDITOR_CATEGORIES.filter((item) => item !== 'Alle')"
              :key="category"
              class="slot-category-checkbox"
            >
              <input
                :checked="templateDraft.slotCategories?.includes(category)"
                type="checkbox"
                @change="(e) => {
                  const cats = [...(templateDraft.slotCategories || [])];
                  if (e.target.checked) {
                    if (!cats.includes(category)) cats.push(category);
                  } else {
                    cats.splice(cats.indexOf(category), 1);
                  }
                  updateDraftField('slotCategories', cats);
                }"
              />
              <span>{{ category }}</span>
            </label>
          </div>
        </div>

        <div class="template-editor-section">
          <div class="position-grid">
            <label class="position-input">
              <span>X</span>
              <input
                :value="templateDraft.x"
                type="number"
                step="0.1"
                @change="(e) => updateDraftField('x', e.target.value)"
              />
            </label>
            <label class="position-input">
              <span>Z</span>
              <input
                :value="templateDraft.z"
                type="number"
                step="0.1"
                @change="(e) => updateDraftField('z', e.target.value)"
              />
            </label>
            <label class="position-input">
              <span>Y</span>
              <input
                :value="templateDraft.y"
                type="number"
                step="0.1"
                @change="(e) => updateDraftField('y', e.target.value)"
              />
            </label>
            <label class="position-input">
              <span>Rotatie (deg)</span>
              <input
                :value="templateDraft.rotationDeg"
                type="number"
                step="1"
                @change="(e) => updateDraftField('rotationDeg', e.target.value)"
              />
            </label>
          </div>
        </div>

        <div class="template-editor-section">
          <div class="accepts-row">
            <label>
              <input
                :checked="templateDraft.acceptsMeubel"
                type="checkbox"
                @change="(e) => updateDraftField('acceptsMeubel', e.target.checked)"
              />
              meubel
            </label>
            <label>
              <input
                :checked="templateDraft.acceptsPersoonlijk"
                type="checkbox"
                @change="(e) => updateDraftField('acceptsPersoonlijk', e.target.checked)"
              />
              persoonlijk
            </label>
            <label>
              <input
                :checked="templateDraft.acceptsDecoratie"
                type="checkbox"
                @change="(e) => updateDraftField('acceptsDecoratie', e.target.checked)"
              />
              decoratie
            </label>
          </div>
        </div>

        <div class="template-editor-section">
          <div class="button-grid-2">
            <button type="button" class="template-btn" @click="applyDraft">Toepassen</button>
            <button type="button" class="template-btn" @click="createSlot">Nieuw slot</button>
            <button type="button" class="template-btn" @click="saveLocal">Lokaal opslaan</button>
            <button type="button" class="template-btn full-width" @click="resetDefaults">Reset template</button>
          </div>
        </div>

        <div class="template-editor-section">
          <div class="button-grid-3">
            <button type="button" class="template-btn" @click="toggleDrag">Verslepen</button>
            <button type="button" class="template-btn" @click="setDragMode('translate')">Verplaatsen</button>
            <button type="button" class="template-btn" @click="setDragMode('rotate')">Roteren</button>
          </div>
        </div>

        <div class="template-editor-section">
          <p class="template-tip">Tip: kies een slot, zet verslepen aan, en sleep direct in de scene.</p>
        </div>

        <div v-if="templateEditorMessage" class="template-editor-message">
          {{ templateEditorMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.template-editor-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.template-editor-modal {
  background: #1a1f2e;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  width: min(90vw, 600px);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}

.template-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.template-editor-header h2 {
  margin: 0;
  color: #fff;
  font-size: 18px;
}

.template-editor-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.2s;
}

.template-editor-close:hover {
  background: rgba(255, 255, 255, 0.1);
}

.template-editor-content {
  overflow-y: auto;
  padding: 16px 20px;
  display: grid;
  gap: 16px;
}

.template-editor-section {
  display: grid;
  gap: 8px;
}

.template-editor-section > span:first-child {
  color: #fff;
  font-size: 13px;
  font-weight: 500;
}

.template-editor-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #fff;
  font-size: 13px;
}

.category-badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 11px;
}

.category-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.category-btn {
  padding: 5px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.category-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.category-btn.active {
  background: #1f5eff;
  border-color: #1f5eff;
}

.template-editor-label {
  display: grid;
  gap: 4px;
}

.template-editor-label > span {
  color: #fff;
  font-size: 13px;
  font-weight: 500;
}

.template-editor-select {
  padding: 6px 8px;
  border-radius: 6px;
  background: #0f1720;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 13px;
}

.slot-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.slot-category-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
  color: #fff;
  font-size: 12px;
}

.slot-category-checkbox input {
  cursor: pointer;
}

.position-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.position-input {
  display: grid;
  gap: 4px;
}

.position-input > span {
  color: #fff;
  font-size: 12px;
}

.position-input input {
  padding: 6px 8px;
  border-radius: 6px;
  background: #0f1720;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 13px;
}

.accepts-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.accepts-row label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}

.accepts-row input {
  cursor: pointer;
}

.button-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.button-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.template-btn {
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.template-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.template-btn.full-width {
  grid-column: 1 / -1;
}

.template-tip {
  margin: 0;
  color: rgba(255, 255, 255, 0.8);
  font-size: 11px;
  line-height: 1.4;
}

.template-editor-message {
  color: #d8f3dc;
  font-size: 11px;
  padding: 8px;
  background: rgba(216, 243, 220, 0.1);
  border-radius: 6px;
}
</style>
