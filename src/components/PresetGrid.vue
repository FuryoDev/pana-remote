<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

interface PresetTileState {
  loading: boolean
  objectUrl: string | null
  error: string | null
  recalling: boolean
  feedback: string | null
}

interface PresetSlot {
  id: string
  type: 'button' | null
}

type PresetTab = 'presets' | 'tab2' | 'tab3' | 'tab4'

const presets = [1, 2, 3, 4, 5, 6]
const tiles = reactive<Record<number, PresetTileState>>({})
const layouts = reactive<Record<number, PresetSlot[]>>({})
const isRefreshing = ref(false)
const activeTab = ref<PresetTab>('presets')
const selectedPreset = ref(presets[0])
const cleanupTimers: Array<() => void> = []
const LAYOUT_STORAGE_KEY = 'pana-remote:presets-layouts'

function createDefaultLayout(preset: number): PresetSlot[] {
  return Array.from({ length: 6 }, (_, index) => ({
    id: `${preset}-${index}`,
    type: null,
  }))
}

function ensurePresetState(preset: number) {
  if (!tiles[preset]) {
    tiles[preset] = {
      loading: true,
      objectUrl: null,
      error: null,
      recalling: false,
      feedback: null,
    }
  }

  if (!layouts[preset]) {
    layouts[preset] = createDefaultLayout(preset)
  }
}

function loadLayoutsFromStorage() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (!raw) {
      return
    }

    const parsed = JSON.parse(raw) as Record<string, Array<{ type: string | null }>>
    for (const preset of presets) {
      const storedSlots = parsed?.[preset]
      if (!Array.isArray(storedSlots)) {
        continue
      }

      layouts[preset] = storedSlots.map((slot, index) => ({
        id: `${preset}-${index}`,
        type: slot?.type === 'button' ? 'button' : null,
      }))
    }
  } catch (error) {
    console.warn('Impossible de charger les layouts de presets', error)
  }
}

function persistLayouts() {
  if (typeof window === 'undefined') {
    return
  }

  const payload: Record<number, Array<{ type: string | null }>> = {}
  for (const preset of presets) {
    payload[preset] = layouts[preset]?.map((slot) => ({ type: slot.type })) ?? []
  }

  window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(payload))
}

for (const preset of presets) {
  ensurePresetState(preset)
}

async function loadThumbnail(preset: number) {
  const tile = tiles[preset]!
  tile.loading = true
  tile.error = null
  tile.feedback = null

  if (tile.objectUrl) {
    URL.revokeObjectURL(tile.objectUrl)
    tile.objectUrl = null
  }

  try {
    const response = await fetch(`/api/preset/${preset}/thumbnail`)
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.error ?? `HTTP ${response.status}`)
    }

    const blob = await response.blob()
    tile.objectUrl = URL.createObjectURL(blob)
  } catch (error: any) {
    tile.error = error?.message ?? 'Miniature indisponible'
  } finally {
    tile.loading = false
  }
}

async function refreshAll() {
  if (isRefreshing.value) {
    return
  }

  isRefreshing.value = true
  await Promise.all(presets.map((preset) => loadThumbnail(preset)))
  isRefreshing.value = false
}

async function recallPreset(preset: number) {
  const tile = tiles[preset]!
  if (tile.recalling) {
    return
  }

  tile.recalling = true
  tile.feedback = null

  try {
    const response = await fetch('/api/preset/recall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ n: preset }),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload.error ?? `HTTP ${response.status}`)
    }

    tile.feedback = 'Preset rappelé'
  } catch (error: any) {
    tile.feedback = error?.message ?? 'Commande refusée'
  } finally {
    tile.recalling = false
  }
}

function resetFeedbackTimers() {
  cleanupTimers.splice(0).forEach((dispose) => dispose())

  for (const preset of presets) {
    const tile = tiles[preset]!
    if (!tile?.feedback) {
      continue
    }

    const handle = setTimeout(() => {
      if (tiles[preset]) {
        tiles[preset]!.feedback = null
      }
    }, 2500)

    cleanupTimers.push(() => clearTimeout(handle))
  }
}

function selectPreset(preset: number) {
  selectedPreset.value = preset
}

function handlePaletteDragStart(event: DragEvent) {
  event.dataTransfer?.setData('application/preset-element', 'button')
  event.dataTransfer?.setData('text/plain', 'Bouton')
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy'
  }
}

function handleSlotDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function handleSlotDrop(preset: number, slotIndex: number, event: DragEvent) {
  event.preventDefault()
  const elementType = event.dataTransfer?.getData('application/preset-element')
  if (elementType !== 'button') {
    return
  }

  const slots = layouts[preset]
  if (!slots) {
    return
  }

  const currentSlot = slots[slotIndex]
  if (!currentSlot) {
    return
  }

  slots[slotIndex] = {
    ...currentSlot,
    type: 'button',
  }
}

function clearSlot(preset: number, slotIndex: number) {
  const slots = layouts[preset]
  if (!slots) {
    return
  }

  const currentSlot = slots[slotIndex]
  if (!currentSlot) {
    return
  }

  slots[slotIndex] = {
    ...currentSlot,
    type: null,
  }
}

onMounted(() => {
  loadLayoutsFromStorage()
  void refreshAll()
})

watch(
  () => presets.map((preset) => tiles[preset]?.feedback ?? null),
  () => {
    resetFeedbackTimers()
  }
)

watch(
  layouts,
  () => {
    persistLayouts()
  },
  { deep: true }
)

onUnmounted(() => {
  resetFeedbackTimers()
  for (const preset of presets) {
    const tile = tiles[preset]
    if (tile?.objectUrl) {
      URL.revokeObjectURL(tile.objectUrl)
      tile.objectUrl = null
    }
  }
})

const presetEntries = computed(() =>
  presets.map((preset) => ({
    preset,
    state: tiles[preset]!,
    slots: layouts[preset]!,
  }))
)

const selectedEntry = computed(() =>
  presetEntries.value.find((entry) => entry.preset === selectedPreset.value)
)

const tabDefinitions: Array<{ id: PresetTab; label: string }> = [
  { id: 'presets', label: 'Presets' },
  { id: 'tab2', label: 'Onglet 2' },
  { id: 'tab3', label: 'Onglet 3' },
  { id: 'tab4', label: 'Onglet 4' },
]
</script>

<template>
  <section class="preset-manager">
    <header class="preset-manager__header">
      <h2>Presets</h2>
      <button type="button" @click="refreshAll" :disabled="isRefreshing">
        {{ isRefreshing ? 'Actualisation…' : 'Rafraîchir les miniatures' }}
      </button>
    </header>

    <nav class="preset-manager__tabs" aria-label="Sections des presets">
      <button
        v-for="tab in tabDefinitions"
        :key="tab.id"
        type="button"
        :class="{ 'is-active': activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </nav>

    <div v-if="activeTab === 'presets'" class="preset-manager__content">
      <div class="preset-manager__selected" v-if="selectedEntry">
        <div class="preset-manager__selected-header">
          <div>
            <h3>Preset sélectionné · {{ selectedEntry.preset }}</h3>
            <p class="preset-manager__hint">Glissez-déposez des éléments pour construire votre preset.</p>
          </div>
          <button type="button" @click="recallPreset(selectedEntry.preset)" :disabled="selectedEntry.state.recalling">
            {{ selectedEntry.state.recalling ? 'Envoi…' : 'Rappeler' }}
          </button>
        </div>

        <div class="preset-editor">
          <div class="preset-editor__grid">
            <div
              v-for="(slot, index) in selectedEntry.slots"
              :key="slot.id"
              class="preset-editor__slot"
              :class="{ 'has-element': slot.type }"
              @dragover="handleSlotDragOver"
              @drop="handleSlotDrop(selectedEntry.preset, index, $event)"
            >
              <template v-if="slot.type === 'button'">
                <button type="button" class="preset-editor__button" draggable="true" @dragstart="handlePaletteDragStart">
                  Bouton vide
                </button>
                <button type="button" class="preset-editor__clear" @click="clearSlot(selectedEntry.preset, index)">
                  Retirer
                </button>
              </template>
              <template v-else>
                <span class="preset-editor__placeholder">Déposez un élément ici</span>
              </template>
            </div>
          </div>

          <aside class="preset-editor__palette">
            <h4>Éléments disponibles</h4>
            <p>Commencez par faire glisser un bouton vide vers un emplacement libre.</p>
            <button
              type="button"
              class="preset-editor__palette-item"
              draggable="true"
              @dragstart="handlePaletteDragStart"
            >
              Bouton vide
            </button>
            <p class="preset-editor__autosave">Les modifications sont enregistrées automatiquement.</p>
          </aside>
        </div>

        <p v-if="selectedEntry.state.feedback" class="feedback">{{ selectedEntry.state.feedback }}</p>
        <p v-if="selectedEntry.state.error" class="error">{{ selectedEntry.state.error }}</p>
      </div>

      <div class="preset-manager__list">
        <article
          v-for="entry in presetEntries"
          :key="entry.preset"
          class="preset-card"
          :class="{ 'is-selected': entry.preset === selectedPreset }"
        >
          <button type="button" class="preset-card__select" @click="selectPreset(entry.preset)">
            <span>Preset {{ entry.preset }}</span>
          </button>

          <div class="thumbnail" :class="{ loading: entry.state.loading }">
            <template v-if="entry.state.loading">
              <span>Chargement…</span>
            </template>
            <img v-else-if="entry.state.objectUrl" :src="entry.state.objectUrl" :alt="`Preset ${entry.preset}`" />
            <p v-else class="placeholder">Miniature indisponible</p>
          </div>

          <footer class="preset-card__footer">
            <button type="button" @click="recallPreset(entry.preset)" :disabled="entry.state.recalling">
              {{ entry.state.recalling ? 'Envoi…' : 'Rappeler' }}
            </button>
            <button type="button" @click="selectPreset(entry.preset)" class="preset-card__configure">
              Configurer
            </button>
          </footer>
        </article>
      </div>
    </div>

    <div v-else class="preset-manager__placeholder">
      <p>Contenu à venir pour cet onglet.</p>
    </div>
  </section>
</template>

<style scoped>
.preset-manager {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  padding: clamp(1.25rem, 3vw, 1.75rem);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
}

.preset-manager__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

h2 {
  margin: 0;
  font-size: 1.1rem;
}

button {
  appearance: none;
  border: none;
  border-radius: 9999px;
  background: #111827;
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.45rem 1.1rem;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease, background 0.2s ease;
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
}

button:disabled {
  opacity: 0.6;
  cursor: progress;
}

.preset-manager__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.preset-manager__tabs button {
  border-radius: 9999px;
  padding: 0.4rem 1rem;
  background: #e5e7eb;
  color: #111827;
  font-weight: 600;
}

.preset-manager__tabs button.is-active {
  background: #2563eb;
  color: #fff;
}

.preset-manager__content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.preset-manager__selected {
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  padding: clamp(1rem, 3vw, 1.5rem);
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.preset-manager__selected-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preset-manager__selected-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.preset-manager__hint {
  margin: 0.25rem 0 0;
  color: #6b7280;
  font-size: 0.9rem;
}

@media (min-width: 720px) {
  .preset-manager__selected-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .preset-manager__selected-header h3 {
    font-size: 1.2rem;
  }
}

.preset-editor {
  display: grid;
  gap: 1.5rem;
}

@media (min-width: 960px) {
  .preset-editor {
    grid-template-columns: minmax(0, 1fr) 260px;
  }
}

.preset-editor__grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}

.preset-editor__slot {
  min-height: 120px;
  border: 2px dashed #cbd5f5;
  border-radius: 1rem;
  background: #eef2ff;
  color: #4338ca;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
  text-align: center;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.preset-editor__slot.has-element {
  border-style: solid;
  border-color: #2563eb;
  background: #dbeafe;
}

.preset-editor__placeholder {
  font-size: 0.9rem;
  color: #4c1d95;
}

.preset-editor__button {
  width: 100%;
  max-width: 180px;
  background: #2563eb;
}

.preset-editor__clear {
  background: transparent;
  color: #1f2937;
  border: 1px solid #d1d5db;
  border-radius: 9999px;
  padding: 0.35rem 0.9rem;
  font-size: 0.8rem;
}

.preset-editor__palette {
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  padding: 1.25rem;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.preset-editor__palette h4 {
  margin: 0;
  font-size: 1rem;
}

.preset-editor__palette p {
  margin: 0;
  font-size: 0.85rem;
  color: #4b5563;
}

.preset-editor__palette-item {
  align-self: flex-start;
  background: #2563eb;
}

.preset-editor__autosave {
  font-style: italic;
  color: #6b7280;
}

.preset-manager__list {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.preset-card {
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  background: #f9fafb;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.preset-card.is-selected {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.18);
  border-color: #2563eb;
}

.preset-card__select {
  width: 100%;
  background: transparent;
  color: #1f2937;
  border: 1px solid #d1d5db;
}

.preset-card__select span {
  font-weight: 600;
}

.preset-card__footer {
  display: flex;
  gap: 0.5rem;
}

.preset-card__footer button {
  flex: 1;
}

.preset-card__configure {
  background: #111827;
}

.thumbnail {
  border-radius: 0.75rem;
  overflow: hidden;
  background: #1f2937;
  color: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
  position: relative;
}

.thumbnail.loading {
  background: repeating-linear-gradient(
    45deg,
    rgba(79, 70, 229, 0.12),
    rgba(79, 70, 229, 0.12) 10px,
    rgba(79, 70, 229, 0.22) 10px,
    rgba(79, 70, 229, 0.22) 20px
  );
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 500;
}

.error {
  margin: 0;
  font-size: 0.85rem;
  color: #b91c1c;
}

.feedback {
  margin: 0;
  font-size: 0.85rem;
  color: #0f766e;
}

.preset-manager__placeholder {
  border: 1px dashed #cbd5e1;
  border-radius: 1rem;
  padding: 2.5rem 1.5rem;
  text-align: center;
  color: #64748b;
  background: #f8fafc;
}
</style>
