<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

type PresetTab = 'controls' | 'management' | 'assignment'

type CameraReference = {
  id: string
  name: string
  location?: string
  status?: 'online' | 'offline'
}

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

const props = defineProps<{
  selectedCamera: CameraReference | null
  assignedPreset: number | null
}>()

const emit = defineEmits<{ (e: 'assign', preset: number): void }>()

const presets = [1, 2, 3, 4, 5, 6]
const tiles = reactive<Record<number, PresetTileState>>({})
const layouts = reactive<Record<number, PresetSlot[]>>({})
const isRefreshing = ref(false)
const activeTab = ref<PresetTab>('controls')
const selectedPreset = ref<number>(presets[0] ?? 1)
const isEditing = ref(false)
const assignmentMessage = ref<string | null>(null)
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

function configurePreset(preset: number) {
  selectPreset(preset)
  isEditing.value = true
}

function closeEditing() {
  isEditing.value = false
}

function handlePaletteDragStart(event: DragEvent) {
  if (!isEditing.value) {
    return
  }

  event.dataTransfer?.setData('application/preset-element', 'button')
  event.dataTransfer?.setData('text/plain', 'Bouton')
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy'
  }
}

function handleSlotDragOver(event: DragEvent) {
  if (!isEditing.value) {
    return
  }

  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function handleSlotDrop(preset: number, slotIndex: number, event: DragEvent) {
  if (!isEditing.value) {
    return
  }

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
  if (!isEditing.value) {
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
    type: null,
  }
}

function assignCurrentPreset() {
  if (!props.selectedCamera) {
    assignmentMessage.value = 'Sélectionnez une caméra pour l’affectation.'
    return
  }

  emit('assign', selectedPreset.value)
  assignmentMessage.value = `Preset ${selectedPreset.value} assigné à ${props.selectedCamera.name}`
}

onMounted(() => {
  loadLayoutsFromStorage()
  void refreshAll()
})

watch(
  () => presets.map((preset) => tiles[preset]?.feedback ?? null),
  () => {
    resetFeedbackTimers()
  },
)

watch(
  layouts,
  () => {
    persistLayouts()
  },
  { deep: true },
)

watch(
  () => props.selectedCamera?.id,
  () => {
    assignmentMessage.value = null
  },
)

watch(isEditing, (value) => {
  if (!value) {
    assignmentMessage.value = null
  }
})

watch(activeTab, (tab) => {
  if (tab !== 'management') {
    isEditing.value = false
  }
})

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
  })),
)

const selectedEntry = computed(() =>
  presetEntries.value.find((entry) => entry.preset === selectedPreset.value),
)

const assignedPresetTile = computed(() => {
  if (typeof props.assignedPreset !== 'number') {
    return null
  }

  return tiles[props.assignedPreset] ?? null
})

const tabDefinitions: Array<{ id: PresetTab; label: string }> = [
  { id: 'controls', label: 'Contrôles' },
  { id: 'management', label: 'Gestion' },
  { id: 'assignment', label: 'Affectations' },
]
</script>

<template>
  <section class="preset-manager">
    <header class="preset-manager__header">
      <div>
        <h2>Presets</h2>
        <p v-if="selectedCamera">Caméra active · {{ selectedCamera.name }}</p>
        <p v-else>Sélectionnez une caméra pour configurer ses presets.</p>
      </div>
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

    <div v-if="activeTab === 'controls'" class="preset-manager__controls">
      <header>
        <h3>Contrôles du preset</h3>
        <p>Gérez le preset affecté à la caméra prévisualisée.</p>
      </header>

      <div v-if="assignedPreset" class="controls-card">
        <p>
          Le preset <strong>{{ assignedPreset }}</strong> est prêt pour la caméra
          <strong>{{ selectedCamera?.name ?? 'sélectionnée' }}</strong>.
        </p>
        <button
          type="button"
          @click="assignedPreset && recallPreset(assignedPreset)"
          :disabled="!assignedPresetTile || assignedPresetTile.recalling"
        >
          {{ assignedPresetTile?.recalling ? 'Envoi…' : 'Rappeler le preset assigné' }}
        </button>
        <p v-if="assignedPresetTile?.feedback" class="feedback">{{ assignedPresetTile?.feedback }}</p>
        <p v-if="assignedPresetTile?.error" class="error">{{ assignedPresetTile?.error }}</p>
      </div>
      <p v-else class="controls-empty">Aucun preset n’est encore assigné à cette caméra. Rendez-vous dans les onglets Gestion ou Affectations.</p>
    </div>

    <div v-else-if="activeTab === 'management'" class="preset-manager__content">
      <p class="preset-manager__note">
        Faites défiler les presets pour consulter leurs miniatures. Appuyez sur « Configurer » pour ouvrir l’éditeur et
        disposer les éléments.
      </p>

      <div class="preset-manager__layout" :class="{ 'has-editor': isEditing && selectedEntry }">
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
              <button type="button" class="preset-card__configure" @click="configurePreset(entry.preset)">
                Configurer
              </button>
            </footer>
          </article>
        </div>

        <transition name="editor-fade">
          <div v-if="isEditing && selectedEntry" class="preset-editor">
            <header class="preset-editor__header">
              <div>
                <h3>Preset {{ selectedEntry.preset }}</h3>
                <p>Glissez-déposez des éléments pour concevoir votre preset.</p>
              </div>
              <div class="preset-editor__actions">
                <button type="button" class="secondary" @click="closeEditing">Terminer</button>
                <button type="button" @click="recallPreset(selectedEntry.preset)" :disabled="selectedEntry.state.recalling">
                  {{ selectedEntry.state.recalling ? 'Envoi…' : 'Rappeler' }}
                </button>
              </div>
            </header>

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
              <p>Faites glisser un bouton vide vers l’emplacement souhaité.</p>
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

            <p v-if="selectedEntry.state.feedback" class="feedback">{{ selectedEntry.state.feedback }}</p>
            <p v-if="selectedEntry.state.error" class="error">{{ selectedEntry.state.error }}</p>
          </div>
        </transition>
      </div>
    </div>

    <div v-else class="preset-manager__assignment">
      <header>
        <h3>Affecter un preset</h3>
        <p>
          Sélectionnez un preset dans la liste puis assignez-le à la caméra prévisualisée. Cette opération n’est
          disponible qu’après avoir choisi une caméra.
        </p>
      </header>

      <ul class="preset-manager__assignment-list">
        <li
          v-for="entry in presetEntries"
          :key="entry.preset"
          :class="{ 'is-selected': entry.preset === selectedPreset }"
        >
          <button type="button" @click="selectPreset(entry.preset)">
            Preset {{ entry.preset }}
          </button>
        </li>
      </ul>

      <button type="button" class="primary" @click="assignCurrentPreset">Assigner le preset sélectionné</button>
      <p v-if="assignmentMessage" class="assignment-message">{{ assignmentMessage }}</p>

      <div class="assignment-summary" v-if="selectedCamera">
        <h4>Caméra ciblée</h4>
        <p>{{ selectedCamera.name }}</p>
        <p class="assignment-summary__preset">
          Preset actuel :
          <strong>{{ assignedPreset ? `Preset ${assignedPreset}` : 'Aucun preset assigné' }}</strong>
        </p>
      </div>
      <p v-else class="assignment-summary__empty">Aucune caméra sélectionnée pour l’instant.</p>
    </div>

  </section>
</template>

<style scoped>
.preset-manager {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.preset-manager__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.preset-manager__header h2 {
  margin: 0;
  font-size: 1.15rem;
}

.preset-manager__header p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
}

.preset-manager__header button {
  appearance: none;
  border: none;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.55rem 1.4rem;
  cursor: pointer;
  background: var(--accent);
  color: #fff;
  transition: background 0.2s ease, transform 0.2s ease;
}

.preset-manager__header button:disabled {
  opacity: 0.6;
  cursor: progress;
}

.preset-manager__header button:not(:disabled):hover {
  transform: translateY(-1px);
}

.preset-manager__note {
  margin: 0 0 1rem;
  color: var(--text-muted);
  font-size: 0.95rem;
}

.preset-manager__tabs {
  display: inline-flex;
  gap: 0.5rem;
}

.preset-manager__tabs button {
  appearance: none;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.4rem 1rem;
  background: var(--surface-muted);
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.preset-manager__tabs button.is-active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.preset-manager__tabs button:hover {
  background: var(--surface-highlight);
  border-color: var(--accent);
  color: var(--text-primary);
}

.preset-manager__content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.preset-manager__layout {
  display: grid;
  gap: 1.5rem;
}

.preset-manager__layout.has-editor {
  align-items: start;
}

@media (min-width: 1024px) {
  .preset-manager__layout.has-editor {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

.preset-manager__list {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  max-height: 420px;
  overflow-y: auto;
  padding-right: 0.25rem;
}

@media (min-width: 1280px) {
  .preset-manager__list {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.preset-card {
  background: var(--surface-raised);
  border-radius: 1rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  border: 1px solid transparent;
  transition: border-color 0.2s ease, transform 0.2s ease;
  height: 100%;
}

.preset-card.is-selected {
  border-color: var(--accent);
  transform: translateY(-1px);
}

.preset-card__select {
  appearance: none;
  border: none;
  background: transparent;
  padding: 0;
  font-weight: 600;
  font-size: 1rem;
  text-align: left;
  cursor: pointer;
}

.thumbnail {
  border-radius: 0.75rem;
  background: var(--surface-muted);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  min-height: 120px;
}

.thumbnail.loading {
  background: var(--surface-highlight);
}

.thumbnail img {
  width: 100%;
  height: auto;
  display: block;
}

.thumbnail .placeholder {
  margin: 0;
  padding: 0.75rem;
  text-align: center;
}

.preset-card__footer {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: auto;
}

.preset-card__footer button {
  flex: 1;
  appearance: none;
  border: none;
  border-radius: 0.75rem;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.45rem 0.75rem;
  cursor: pointer;
  background: var(--accent);
  color: #fff;
  transition: background 0.2s ease, transform 0.2s ease;
}

.preset-card__footer button:disabled {
  opacity: 0.6;
  cursor: progress;
}

.preset-card__footer button:not(:disabled):hover {
  transform: translateY(-1px);
}

.preset-card__configure {
  background: var(--surface-highlight);
  color: var(--text-primary);
}

.preset-editor {
  background: var(--surface-muted);
  border-radius: 1rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  position: relative;
}

.preset-editor__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.preset-editor__header h3 {
  margin: 0;
  font-size: 1.05rem;
}

.preset-editor__header p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
}

.preset-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.preset-editor__actions button {
  appearance: none;
  border: none;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.4rem 1.2rem;
  cursor: pointer;
  background: var(--accent);
  color: #fff;
  transition: background 0.2s ease, transform 0.2s ease;
}

.preset-editor__actions button:not(.secondary):hover {
  background: var(--accent-strong);
  transform: translateY(-1px);
}

.secondary {
  border: 1px solid var(--accent);
  background: rgba(37, 99, 235, 0.18);
  color: #dbeafe;
}

.secondary:hover {
  background: rgba(37, 99, 235, 0.24);
  border-color: var(--accent-strong);
  transform: translateY(-1px);
}

.preset-editor__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
}

.preset-editor__slot {
  border: 2px dashed rgba(37, 99, 235, 0.24);
  border-radius: 0.85rem;
  min-height: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 0.75rem;
  text-align: center;
  background: rgba(37, 99, 235, 0.08);
  transition: background 0.2s ease, border-color 0.2s ease;
}

.preset-editor__slot.has-element {
  background: rgba(37, 99, 235, 0.16);
  border-color: rgba(37, 99, 235, 0.4);
}

.preset-editor__button {
  appearance: none;
  border: none;
  border-radius: 0.75rem;
  padding: 0.45rem 0.85rem;
  font-weight: 600;
  cursor: grab;
  background: var(--accent);
  color: #fff;
}

.preset-editor__button:active {
  cursor: grabbing;
}

.preset-editor__clear {
  appearance: none;
  border: none;
  border-radius: 999px;
  padding: 0.35rem 0.9rem;
  font-size: 0.8rem;
  cursor: pointer;
  background: var(--surface-highlight);
  color: var(--text-primary);
}

.preset-editor__placeholder {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.preset-editor__palette {
  border-radius: 0.85rem;
  background: var(--surface-raised);
  padding: 1rem;
  display: grid;
  gap: 0.75rem;
  border: 1px solid var(--border);
}

.preset-editor__palette h4 {
  margin: 0;
  font-size: 1rem;
}

.preset-editor__palette p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.preset-editor__palette-item {
  appearance: none;
  border: none;
  border-radius: 0.75rem;
  padding: 0.45rem 0.85rem;
  font-weight: 600;
  background: var(--accent);
  color: #fff;
  cursor: grab;
}

.preset-editor__palette-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preset-editor__autosave {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.editor-fade-enter-active,
.editor-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.editor-fade-enter-from,
.editor-fade-leave-to {
  opacity: 0;
  transform: translateX(8px);
}

.feedback {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 500;
  color: #34d399;
}

.error {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 500;
  color: #f87171;
}

.preset-manager__assignment {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.preset-manager__assignment header h3 {
  margin: 0;
  font-size: 1.05rem;
}

.preset-manager__assignment header p {
  margin: 0.5rem 0 0;
  color: var(--text-muted);
}

.preset-manager__assignment-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.preset-manager__assignment-list li {
  margin: 0;
}

.preset-manager__assignment-list li button {
  appearance: none;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.4rem 1rem;
  font-weight: 600;
  cursor: pointer;
  background: var(--surface-muted);
  color: var(--text-primary);
  transition: border-color 0.2s ease, background 0.2s ease;
}

.preset-manager__assignment-list li button:hover {
  border-color: var(--accent);
  background: var(--surface-highlight);
}

.preset-manager__assignment-list li.is-selected button {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.preset-manager__assignment .primary {
  appearance: none;
  border: none;
  border-radius: 999px;
  padding: 0.6rem 1.6rem;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  background: var(--accent);
  color: #fff;
  align-self: flex-start;
}

.assignment-message {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 500;
  color: #34d399;
}

.assignment-summary {
  border-radius: 0.85rem;
  border: 1px solid var(--border);
  background: var(--surface-raised);
  padding: 1rem;
  display: grid;
  gap: 0.4rem;
}

.assignment-summary h4 {
  margin: 0;
  font-size: 0.95rem;
}

.assignment-summary__preset {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.assignment-summary__preset strong {
  color: var(--accent);
}

.assignment-summary__empty,
.controls-empty {
  margin: 0;
  color: var(--text-muted);
}

.preset-manager__controls {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.preset-manager__controls header h3 {
  margin: 0;
  font-size: 1.05rem;
}

.preset-manager__controls header p {
  margin: 0.45rem 0 0;
  color: var(--text-muted);
}

.controls-card {
  border-radius: 0.9rem;
  border: 1px solid var(--border);
  background: var(--surface-raised);
  padding: 1.25rem;
  display: grid;
  gap: 0.75rem;
}

.controls-card button {
  appearance: none;
  border: none;
  border-radius: 999px;
  padding: 0.6rem 1.6rem;
  font-weight: 600;
  background: var(--accent);
  color: #fff;
  justify-self: flex-start;
  cursor: pointer;
}

.controls-card button:disabled {
  opacity: 0.6;
  cursor: progress;
}
</style>
