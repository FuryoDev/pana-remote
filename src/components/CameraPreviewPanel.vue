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
const CAMERA_HOST = 'http://10.41.39.153'
const SNAPSHOT_ENDPOINT = `${CAMERA_HOST}/cgi-bin/view.cgi`
const FRAME_INTERVAL_MS = 1000 / 12

interface FrameBuffer {
  id: number
  src: string
  isActive: boolean
}

const frameBuffers = ref<FrameBuffer[]>([
  { id: 0, src: '', isActive: false },
  { id: 1, src: '', isActive: false },
])
const activeBuffer = ref<number | null>(null)
const frameSequence = ref(0)
const frameTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const isLoadingStream = ref(false)
const streamError = ref<string | null>(null)
const isStreamActive = ref(false)

const isLiveCamera = computed(() => props.camera?.id === 'cam-01')
const isCameraOnline = computed(() => props.camera?.status === 'online')
const shouldStream = computed(() => isLiveCamera.value && isCameraOnline.value)
const hasActiveFrame = computed(() =>
  frameBuffers.value.some((buffer) => buffer.isActive && buffer.src.length > 0),
)
const overlayMessage = computed(() => {
  if (!isCameraOnline.value) {
    return 'Caméra hors ligne'
  }

  if (!shouldStream.value) {
    return null
  }

  if (streamError.value) {
    return streamError.value
  }

  if (isLoadingStream.value && !hasActiveFrame.value) {
    return 'Connexion au flux…'
  }

  return null
})

// Endpoints pour UNE SEULE caméra (placeholder CAM 1)
const MJPEG_URL = '/api/stream/live/mjpeg'
const SNAPSHOT_URL = '/api/stream/live/snapshot'

const statusLabel = computed(() => {
  if (!props.camera) return 'Aucune caméra sélectionnée'
  return props.camera.status === 'online' ? 'Connectée' : 'Hors-ligne'
})

const snapshotSrc = computed(() => {
  if (!props.camera) return null
  return `${SNAPSHOT_URL}?t=${tick.value}`
})

function handleSurfaceClick() {
  isSurfaceAlert.value = !isSurfaceAlert.value
  emit('surface-click')
}

function triggerCamera(action: 'start' | 'stop') {
  const image = new Image()
  image.referrerPolicy = 'no-referrer'
  const url = new URL(SNAPSHOT_ENDPOINT)
  url.searchParams.set('action', action)
  url.searchParams.set('_', Date.now().toString())
  image.src = url.toString()
}

function clearFrameTimer() {
  if (frameTimer.value !== null) {
    clearTimeout(frameTimer.value)
    frameTimer.value = null
  }
}

function resetBuffers() {
  frameBuffers.value = frameBuffers.value.map((buffer) => ({
    ...buffer,
    src: '',
    isActive: false,
  }))
  activeBuffer.value = null
  frameSequence.value = 0
}

function buildSnapshotUrl(sequence: number) {
  const url = new URL(SNAPSHOT_ENDPOINT)
  url.searchParams.set('action', 'snapshot')
  url.searchParams.set('resolution', '0')
  url.searchParams.set('n', sequence.toString())
  url.searchParams.set('_', Date.now().toString())
  return url.toString()
}

function requestFrame(bufferId: number) {
  const index = frameBuffers.value.findIndex((buffer) => buffer.id === bufferId)
  if (index === -1) {
    return
  }

  const currentBuffer = frameBuffers.value[index]
  if (!currentBuffer) {
    return
  }

  const nextSequence = frameSequence.value + 1
  frameSequence.value = nextSequence

  const nextBuffer: FrameBuffer = {
    ...currentBuffer,
    src: buildSnapshotUrl(nextSequence),
  }

  frameBuffers.value.splice(index, 1, nextBuffer)
}

function scheduleNextFrame(delay = FRAME_INTERVAL_MS) {
  if (!isStreamActive.value) {
    return
  }

  clearFrameTimer()
  frameTimer.value = setTimeout(() => {
    if (!isStreamActive.value) {
      return
    }

    const nextBuffer =
      frameBuffers.value.find((buffer) => buffer.id !== activeBuffer.value) ?? frameBuffers.value[0]

    if (!nextBuffer) {
      return
    }

    isLoadingStream.value = true
    requestFrame(nextBuffer.id)
  }, delay)
}

function handleFrameLoad(bufferId: number) {
  if (!isStreamActive.value) {
    return
  }

  streamError.value = null
  isLoadingStream.value = false
  activeBuffer.value = bufferId

  frameBuffers.value = frameBuffers.value.map((buffer) => ({
    ...buffer,
    isActive: buffer.id === bufferId,
  }))

  scheduleNextFrame()
}

function handleFrameError() {
  if (!isStreamActive.value) {
    return
  }

  streamError.value = 'Flux vidéo indisponible'
  isLoadingStream.value = false
  scheduleNextFrame(1000)
}

function startStream() {
  if (isStreamActive.value) {
    return
  }

  isStreamActive.value = true
  streamError.value = null
  resetBuffers()
  triggerCamera('start')
  isLoadingStream.value = true
  requestFrame(frameBuffers.value[0]?.id ?? 0)
}

function stopStream() {
  if (!isStreamActive.value) {
    return
  }

  isStreamActive.value = false
  triggerCamera('stop')
  clearFrameTimer()
  resetBuffers()
  isLoadingStream.value = false
}

watch(
  shouldStream,
  (value) => {
    if (value) {
      startStream()
    } else {
      stopStream()
      streamError.value = null
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopStream()
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
          <div v-if="isLiveCamera" class="preview-panel__stream" :class="{ 'is-loading': isLoadingStream }">
            <img
              v-for="buffer in frameBuffers"
              :key="buffer.id"
              class="preview-panel__frame"
              :class="{ 'is-active': buffer.isActive }"
              :src="buffer.src"
              :alt="`Trame vidéo ${buffer.id}`"
              @load="handleFrameLoad(buffer.id)"
              @error="handleFrameError"
            />
            <div v-if="overlayMessage" class="preview-panel__overlay">{{ overlayMessage }}</div>
          </div>
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
  overflow: hidden;
}

.preview-panel__video p {
  margin: 0;
}

.preview-panel__stream {
  position: relative;
  width: 100%;
  height: 100%;
}

.preview-panel__frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.18s ease;
  background: #000;
}

.preview-panel__frame.is-active {
  opacity: 1;
}

.preview-panel__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  text-align: center;
  background: rgba(2, 6, 23, 0.78);
  color: var(--text-primary);
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.04em;
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
