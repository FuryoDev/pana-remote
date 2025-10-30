<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

type CameraPreview = {
  id: string
  name: string
  location: string
  status: 'online' | 'offline'
}

const props = defineProps<{
  camera: CameraPreview | null
  assignedPreset: number | null
}>()

const emit = defineEmits<{ (e: 'surface-click'): void }>()

const isSurfaceAlert = ref(false)
const snapshotVersion = ref(0)
const snapshotError = ref<string | null>(null)
let intervalHandle: number | null = null

const isLiveCamera = computed(() => props.camera?.id === 'cam-01')

const snapshotUrl = computed(() => {
  if (!isLiveCamera.value) {
    return null
  }

  return `/api/stream/live/snapshot?t=${snapshotVersion.value}`
})

const statusLabel = computed(() => {
  if (!props.camera) {
    return 'Aucune caméra sélectionnée'
  }

  return props.camera.status === 'online' ? 'Connectée' : 'Hors-ligne'
})

function handleSurfaceClick() {
  isSurfaceAlert.value = !isSurfaceAlert.value
  emit('surface-click')
}

function refreshSnapshot() {
  if (!isLiveCamera.value) {
    return
  }

  snapshotVersion.value = Date.now()
}

function handleSnapshotError() {
  snapshotError.value = "Flux indisponible — vérifiez le proxy vidéo"
}

function handleSnapshotLoad() {
  snapshotError.value = null
}

watch(
  isLiveCamera,
  (active) => {
    if (intervalHandle) {
      clearInterval(intervalHandle)
      intervalHandle = null
    }

    snapshotError.value = null
    if (active) {
      refreshSnapshot()
      intervalHandle = window.setInterval(refreshSnapshot, 1000)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (intervalHandle) {
    clearInterval(intervalHandle)
  }
})
</script>

<template>
  <section class="preview-panel">
    <header class="preview-panel__header">
      <div>
        <h2>{{ camera ? camera.name : 'Sélectionnez une caméra' }}</h2>
        <p v-if="camera">{{ camera.location }}</p>
      </div>
      <span class="preview-panel__status" :data-status="camera?.status">
        {{ statusLabel }}
      </span>
    </header>

    <div class="preview-panel__surface" :class="{ 'is-alert': isSurfaceAlert }" @click="handleSurfaceClick">
      <div class="preview-panel__video" role="presentation">
        <template v-if="camera">
          <template v-if="isLiveCamera">
            <img
              v-if="snapshotUrl"
              class="preview-panel__stream"
              :src="snapshotUrl"
              :alt="`Flux en direct de ${camera.name}`"
              @error="handleSnapshotError"
              @load="handleSnapshotLoad"
            />
            <p v-if="snapshotError" class="preview-panel__error">{{ snapshotError }}</p>
          </template>
          <p v-else>Prévisualisation de {{ camera.name }}</p>
        </template>
        <p v-else>Choisissez une caméra pour commencer</p>
      </div>

      <div class="preview-panel__actions">
        <button type="button" class="take" @click.stop>TAKE</button>
        <button type="button" class="prbu" @click.stop>PRBU</button>
      </div>
    </div>

    <div class="preview-panel__details" v-if="camera">
      <div>
        <span class="preview-panel__label">Preset assigné: </span>
        <span class="preview-panel__value">
          {{ assignedPreset ? `Preset ${assignedPreset}` : 'Aucun preset associé' }}
        </span>
      </div>
      <div>
        <span class="preview-panel__label">Statut: </span>
        <span class="preview-panel__value">{{ statusLabel }}</span>
      </div>
    </div>

  </section>
</template>

<style scoped>
.preview-panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  height: 100%;
}

.preview-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.preview-panel__header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.preview-panel__header p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
}


.preview-panel__status {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.12);
  color: #bfdbfe;
}

.preview-panel__status[data-status='offline'] {
  background: rgba(248, 113, 113, 0.16);
  color: #fecaca;
}

.preview-panel__surface {
  position: relative;
  border-radius: 1rem;
  overflow: hidden;
  background: radial-gradient(circle at center, rgba(37, 99, 235, 0.15), rgba(15, 23, 42, 0.65));
  border: 2px solid #0b1220;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
}

.preview-panel__surface.is-alert {
  border-color: var(--danger);
  box-shadow: 0 0 0 2px rgba(248, 113, 113, 0.25);
}

.preview-panel__video {
  position: relative;
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 0.85rem;
  background: rgba(15, 23, 42, 0.55);
}

.preview-panel__video p {
  margin: 0;
}

.preview-panel__stream {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.preview-panel__error {
  position: absolute;
  inset: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.85);
  color: #fca5a5;
  font-size: 0.9rem;
  text-align: center;
  padding: 1rem;
}

.preview-panel__details {
  display: grid;
  gap: 0.75rem;
}

.preview-panel__label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.preview-panel__value {
  font-size: 0.95rem;
  color: var(--text-primary);
}

.preview-panel__actions {
  position: absolute;
  left: 50%;
  bottom: 1.25rem;
  transform: translateX(-50%);
  display: inline-flex;
  gap: 0.75rem;
  padding: 0.6rem 1rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.18);
  backdrop-filter: blur(6px);
}

.preview-panel__actions button {
  appearance: none;
  border: none;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 0.55rem 1.75rem;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
  color: #f8fafc;
}

.preview-panel__actions button.take {
  background: var(--accent);
}

.preview-panel__actions button.prbu {
  background: var(--surface-highlight);
}

.preview-panel__actions button:hover {
  transform: translateY(-1px);
}
</style>
