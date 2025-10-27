<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import CameraStatusPanel from './components/CameraStatusPanel.vue'
import CameraPreviewPanel from './components/CameraPreviewPanel.vue'
import CameraTestButton from './components/CameraTestButton.vue'
import PresetGrid from './components/PresetGrid.vue'
import { useCameraStatus } from './composables/useCameraStatus'

type ActiveContext = 'camera-list' | 'camera-preview' | 'status'

interface CameraSummary {
  id: string
  name: string
  location: string
  status: 'online' | 'offline'
}

const { status, isLoading, error, lastUpdated, refresh } = useCameraStatus()

const cameras = ref<CameraSummary[]>([
  { id: 'cam-01', name: 'Auditorium A', location: 'Salle principale', status: 'online' },
  { id: 'cam-02', name: 'Auditorium B', location: 'Salle principale', status: 'online' },
  { id: 'cam-03', name: 'Balcon A', location: 'Niveau 2', status: 'online' },
  { id: 'cam-04', name: 'Balcon B', location: 'Niveau 2', status: 'offline' },
  { id: 'cam-05', name: 'Régie', location: 'Niveau 1', status: 'online' },
  { id: 'cam-06', name: 'Lobby', location: 'Rez-de-chaussée', status: 'online' },
  { id: 'cam-07', name: 'Entrée Est', location: 'Extérieur', status: 'offline' },
  { id: 'cam-08', name: 'Entrée Ouest', location: 'Extérieur', status: 'online' },
  { id: 'cam-09', name: 'Foyer', location: 'Rez-de-chaussée', status: 'online' },
  { id: 'cam-10', name: 'Studio', location: 'Sous-sol', status: 'online' },
])

const camerasPerPage = ref(5)
const currentPage = ref(1)
const activeContext = ref<ActiveContext>('camera-preview')
const assignedPresets = reactive<Record<string, number | null>>({})

const totalPages = computed(() => {
  const total = Math.ceil(cameras.value.length / camerasPerPage.value)
  return total > 0 ? total : 1
})

const pageOptions = [5, 10]

const paginatedCameras = computed(() => {
  const start = (currentPage.value - 1) * camerasPerPage.value
  return cameras.value.slice(start, start + camerasPerPage.value)
})

watch([camerasPerPage, cameras], () => {
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value
  }
})

watch(camerasPerPage, () => {
  currentPage.value = 1
})

const selectedCameraId = ref(cameras.value[0]?.id ?? null)

const selectedCamera = computed(() =>
  cameras.value.find((camera) => camera.id === selectedCameraId.value) ?? null,
)

const selectedCameraAssignedPreset = computed(() => {
  const camera = selectedCamera.value
  if (!camera) {
    return null
  }

  return assignedPresets[camera.id] ?? null
})

function setContext(context: ActiveContext) {
  activeContext.value = context
}

function selectCamera(cameraId: string) {
  selectedCameraId.value = cameraId
}

function goToPreviousPage() {
  if (currentPage.value > 1) {
    currentPage.value -= 1
  }
}

function goToNextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value += 1
  }
}

function handleAssignPreset(preset: number) {
  if (!selectedCamera.value) {
    return
  }

  assignedPresets[selectedCamera.value.id] = preset
}

const cameraListForFilters = computed(() =>
  cameras.value.map((camera) => ({
    id: camera.id,
    label: `${camera.name} — ${camera.location}`,
    status: camera.status,
  })),
)
</script>

<template>
  <main class="app">
    <header class="app__header">
      <div>
        <h1>Panasonic Remote Control</h1>
        <p>
          Préparez vos tests de communication : vérifiez la connexion, gérez les presets et pilotez le flux
          vidéo.
        </p>
      </div>
      <CameraTestButton />
    </header>

    <div class="status-wrapper" @click="setContext('status')">
      <CameraStatusPanel
        :status="status"
        :is-loading="isLoading"
        :error="error"
        :last-updated="lastUpdated"
        @retry="refresh"
      />
    </div>

    <section class="workspace">
      <div class="workspace__left">
        <div class="camera-selector" @click="setContext('camera-list')">
          <header class="camera-selector__header">
            <div>
              <h2>Caméras disponibles</h2>
              <p>Choisissez une caméra pour afficher sa prévisualisation.</p>
            </div>
            <div class="camera-selector__pagination">
              <button type="button" @click.stop="goToPreviousPage" :disabled="currentPage === 1">◀</button>
              <span>Page {{ currentPage }} / {{ totalPages }}</span>
              <button type="button" @click.stop="goToNextPage" :disabled="currentPage === totalPages">▶</button>
            </div>
          </header>

          <ul class="camera-selector__grid">
            <li v-for="camera in paginatedCameras" :key="camera.id">
              <button
                type="button"
                class="camera-selector__item"
                :class="{ 'is-selected': camera.id === selectedCameraId }"
                @click.stop="selectCamera(camera.id)"
              >
                <div class="camera-selector__thumbnail" aria-hidden="true">
                  <span>{{ camera.name.charAt(0) }}</span>
                </div>
                <div class="camera-selector__meta">
                  <h3>{{ camera.name }}</h3>
                  <p>{{ camera.location }}</p>
                </div>
                <span class="camera-selector__status" :data-status="camera.status">
                  {{ camera.status === 'online' ? 'Connectée' : 'Hors-ligne' }}
                </span>
              </button>
            </li>
          </ul>
        </div>

        <div class="workspace__preview">
          <CameraPreviewPanel
            :camera="selectedCamera"
            :assigned-preset="selectedCameraAssignedPreset"
            @surface-click="setContext('camera-preview')"
          />
        </div>
      </div>

      <aside class="workspace__side-panel">
        <transition name="panel-fade" mode="out-in">
          <div v-if="activeContext === 'camera-list'" key="camera-list" class="side-panel">
            <header>
              <h2>Filtrer les caméras</h2>
              <p>Affinez la navigation dans la liste des caméras.</p>
            </header>

            <label class="side-panel__field">
              Caméras par page
              <select v-model.number="camerasPerPage">
                <option v-for="option in pageOptions" :key="option" :value="option">{{ option }}</option>
              </select>
            </label>

            <div class="side-panel__list">
              <h3>Toutes les caméras</h3>
              <ul>
                <li v-for="camera in cameraListForFilters" :key="camera.id">
                  <span class="side-panel__camera-name">{{ camera.label }}</span>
                  <span class="side-panel__camera-status" :data-status="camera.status">
                    {{ camera.status === 'online' ? 'Connectée' : 'Hors-ligne' }}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div v-else-if="activeContext === 'status'" key="status" class="side-panel">
            <header>
              <h2>Résumé du statut</h2>
              <p>Synthèse rapide des informations de connexion.</p>
            </header>

            <ul class="side-panel__status" v-if="status">
              <li>
                <span class="side-panel__label">UID</span>
                <span class="side-panel__value">{{ status.uid }}</span>
              </li>
              <li>
                <span class="side-panel__label">Flux</span>
                <span class="side-panel__value">{{ status.streaming || 'Non communiqué' }}</span>
              </li>
              <li v-if="lastUpdated">
                <span class="side-panel__label">Dernière mise à jour</span>
                <span class="side-panel__value">{{ new Date(lastUpdated).toLocaleTimeString() }}</span>
              </li>
            </ul>
            <p v-else class="side-panel__empty">Aucune donnée de statut disponible.</p>
          </div>

          <div v-else key="camera-preview" class="side-panel">
            <PresetGrid
              :selected-camera="selectedCamera"
              :assigned-preset="selectedCameraAssignedPreset"
              @assign="handleAssignPreset"
            />
          </div>
        </transition>
      </aside>
    </section>
  </main>
</template>

<style scoped>
:global(:root) {
  color-scheme: dark;
  --bg-app: #020617;
  --surface: #0f172a;
  --surface-raised: #111c2e;
  --surface-muted: #16213b;
  --surface-highlight: #1d2b4a;
  --border: #1e293b;
  --border-strong: #334155;
  --text-primary: #e2e8f0;
  --text-muted: #94a3b8;
  --accent: #2563eb;
  --accent-strong: #1d4ed8;
  --accent-soft: rgba(37, 99, 235, 0.16);
  --danger: #f87171;
  --success: #22c55e;
  --shadow-elevated: 0 24px 45px rgba(3, 6, 18, 0.45);
}

:global(body) {
  background: var(--bg-app);
  color: var(--text-primary);
}

.app {
  min-height: 100vh;
  padding: clamp(1.5rem, 4vw, 3rem);
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 95%;
  margin: 0 auto;
  color: var(--text-primary);
}

.app__header {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .app__header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

h1 {
  margin: 0 0 0.5rem;
  font-size: clamp(2rem, 4vw, 2.75rem);
}

p {
  margin: 0;
  color: var(--text-muted);
  max-width: 40rem;
  line-height: 1.6;
}

.status-wrapper {
  cursor: pointer;
}

.workspace {
  display: grid;
  gap: 1.5rem;
}

@media (min-width: 1120px) {
  .workspace {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
    align-items: stretch;
  }
}

.workspace__left {
  display: grid;
  gap: 1.5rem;
}

@media (min-width: 960px) {
  .workspace__left {
    grid-template-rows: minmax(260px, auto) minmax(320px, auto);
  }
}

.camera-selector,
.workspace__preview,
.workspace__side-panel > .side-panel,
.status-wrapper > * {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 1rem;
  box-shadow: var(--shadow-elevated);
}

.camera-selector {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  cursor: pointer;
}

.camera-selector__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.camera-selector__header h2 {
  margin: 0;
  font-size: 1.1rem;
}

.camera-selector__header p {
  margin-top: 0.4rem;
  color: var(--text-muted);
}

.camera-selector__pagination {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
}

.camera-selector__pagination button {
  appearance: none;
  border: 1px solid var(--border-strong);
  background: var(--surface-muted);
  color: var(--text-primary);
  border-radius: 999px;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
}

.camera-selector__pagination button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.camera-selector__pagination button:not(:disabled):hover {
  background: var(--surface-highlight);
  border-color: var(--accent);
  transform: translateY(-1px);
}

.camera-selector__grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  gap: 1rem;
  flex-wrap: nowrap;
}

.camera-selector__grid li {
  flex: 1;
}

.camera-selector__item {
  width: 100%;
  border: 1px solid transparent;
  background: var(--surface-raised);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  align-items: stretch;
  padding: 1rem;
  border-radius: 0.875rem;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  text-align: left;
}

.camera-selector__item:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: 0 18px 30px rgba(11, 16, 32, 0.45);
}

.camera-selector__item.is-selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.camera-selector__thumbnail {
  aspect-ratio: 16 / 9;
  border-radius: 0.75rem;
  background: linear-gradient(135deg, #1e3a8a, #0ea5e9);
  color: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.5rem;
  letter-spacing: 0.05em;
}

.camera-selector__meta {
  display: grid;
  gap: 0.35rem;
}

.camera-selector__meta h3 {
  margin: 0;
  font-size: 1rem;
}

.camera-selector__meta p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.camera-selector__status {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.12);
  color: #bfdbfe;
}

.camera-selector__status[data-status='offline'] {
  background: rgba(248, 113, 113, 0.16);
  color: #fecaca;
}

.workspace__preview {
  padding: 1.5rem;
  min-height: 320px;
}

.workspace__side-panel {
  min-height: 400px;
}

.side-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 1rem;
  box-shadow: var(--shadow-elevated);
}

.side-panel header h2 {
  margin: 0;
  font-size: 1.1rem;
}

.side-panel header p {
  margin-top: 0.4rem;
  color: var(--text-muted);
}

.side-panel__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.side-panel__field select {
  border-radius: 0.75rem;
  border: 1px solid var(--border-strong);
  padding: 0.45rem 0.75rem;
  font-size: 0.95rem;
  background: var(--surface-muted);
  color: var(--text-primary);
}

.side-panel__list ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.6rem;
}

.side-panel__list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  padding: 0.55rem 0.75rem;
  border-radius: 0.75rem;
  background: var(--surface-raised);
  border: 1px solid var(--border);
}

.side-panel__camera-name {
  font-weight: 500;
  color: var(--text-primary);
}

.side-panel__camera-status {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.12);
  color: #bfdbfe;
}

.side-panel__camera-status[data-status='offline'] {
  background: rgba(248, 113, 113, 0.16);
  color: #fecaca;
}

.side-panel__status {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.75rem;
}

.side-panel__status li {
  display: grid;
  gap: 0.3rem;
}

.side-panel__label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.side-panel__value {
  font-size: 0.95rem;
  color: var(--text-primary);
}

.side-panel__empty {
  margin: 0;
  color: var(--text-muted);
}

.panel-fade-enter-active,
.panel-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.panel-fade-enter-from,
.panel-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
