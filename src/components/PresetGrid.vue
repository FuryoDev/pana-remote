<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

type PresetTab = 'controls' | 'assignment'

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

const props = defineProps<{
  selectedCamera: CameraReference | null
  assignedPreset: number | null
}>()

const emit = defineEmits<{ (e: 'assign', preset: number): void }>()

const presets = [1, 2, 3, 4, 5, 6]
const tiles = reactive<Record<number, PresetTileState>>({})
const isRefreshing = ref(false)
const activeTab = ref<PresetTab>('controls')
const selectedPreset = ref<number>(presets[0] ?? 1)
const assignmentMessage = ref<string | null>(null)
const cleanupTimers: Array<() => void> = []

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
  if (isRefreshing.value) return

  isRefreshing.value = true
  await Promise.all(presets.map((preset) => loadThumbnail(preset)))
  isRefreshing.value = false
}

async function recallPreset(preset: number) {
  const tile = tiles[preset]!
  if (tile.recalling) return

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
    if (!tile?.feedback) continue

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

function assignCurrentPreset() {
  if (!props.selectedCamera) {
    assignmentMessage.value = 'Sélectionnez une caméra pour l’affectation.'
    return
  }

  emit('assign', selectedPreset.value)
  assignmentMessage.value = `Preset ${selectedPreset.value} assigné à ${props.selectedCamera.name}`
}

onMounted(() => {
  void refreshAll()
})

watch(
  () => presets.map((preset) => tiles[preset]?.feedback ?? null),
  () => {
    resetFeedbackTimers()
  },
)

watch(
  () => props.selectedCamera?.id,
  () => {
    assignmentMessage.value = null
  },
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
  })),
)

const assignedPresetTile = computed(() => {
  if (typeof props.assignedPreset !== 'number') return null
  return tiles[props.assignedPreset] ?? null
})

const tabDefinitions: Array<{ id: PresetTab; label: string }> = [
  { id: 'controls', label: 'Contrôles' },
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

    <!-- Onglet Contrôles -->
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
      <p v-else class="controls-empty">
        Aucun preset n’est encore assigné à cette caméra. Rendez-vous dans l’onglet Affectations.
      </p>
    </div>

    <!-- Onglet Affectations -->
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
</style>
