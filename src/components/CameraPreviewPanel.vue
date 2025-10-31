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
const isTestingControls = ref(false)
const testMessage = ref<string | null>(null)
const testLog = ref<string[]>([])

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
const tick = ref(Date.now())

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

function wait(delay: number) {
  return new Promise((resolve) => setTimeout(resolve, delay))
}

async function runControlTest() {
  if (isTestingControls.value) {
    return
  }

  isTestingControls.value = true
  testMessage.value = null
  testLog.value = []

  const appendLog = (message: string) => {
    testLog.value = [...testLog.value, message]
  }

  const ensureOk = async (request: Promise<Response>) => {
    const response = await request
    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || `Requête échouée (${response.status})`)
    }
    return response
  }

  try {
    appendLog('Lecture de la position actuelle…')
    await ensureOk(fetch('/api/ptz/location'))
    appendLog('Position récupérée.')

    appendLog('Déplacement de la caméra…')
    await ensureOk(
      fetch('/api/ptz/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'up-right', speed: 12 }),
      }),
    )

    await wait(1200)

    await ensureOk(
      fetch('/api/ptz/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    appendLog('Mouvement terminé.')

    appendLog('Déclenchement du focus…')
    await ensureOk(
      fetch('/api/camera/focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'near', speed: 10 }),
      }),
    )

    await wait(800)

    await ensureOk(
      fetch('/api/camera/focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'stop' }),
      }),
    )
    appendLog('Focus relâché.')

    appendLog('Zoom non testé (action ignorée pour ce scénario).')
    appendLog('Réglage de vitesse non testé (action ignorée pour ce scénario).')

    testMessage.value = 'Séquence de test effectuée avec succès.'
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Erreur inattendue'
    testMessage.value = `Échec du test : ${message}`
    appendLog("Le test a été interrompu en raison d'une erreur.")
  } finally {
    isTestingControls.value = false
  }
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
      <div class="preview-panel__test">
        <button
          type="button"
          class="preview-panel__test-button"
          :disabled="isTestingControls"
          @click="runControlTest"
        >
          {{ isTestingControls ? 'Test en cours…' : 'Tester les actions caméra' }}
        </button>
        <p v-if="testMessage" class="preview-panel__test-message">{{ testMessage }}</p>
        <ul v-if="testLog.length" class="preview-panel__test-log">
          <li v-for="(entry, index) in testLog" :key="index">{{ entry }}</li>
        </ul>
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

.preview-panel__test {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.preview-panel__test-button {
  align-self: flex-start;
  background: linear-gradient(120deg, rgba(59, 130, 246, 0.9), rgba(14, 165, 233, 0.85));
  border: none;
  border-radius: 999px;
  color: #f8fafc;
  cursor: pointer;
  font-weight: 600;
  letter-spacing: 0.05em;
  padding: 0.55rem 1.2rem;
  text-transform: uppercase;
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.preview-panel__test-button:not(:disabled):hover {
  transform: translateY(-1px);
}

.preview-panel__test-button:disabled {
  opacity: 0.65;
  cursor: wait;
  transform: none;
}

.preview-panel__test-message {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.preview-panel__test-log {
  margin: 0;
  padding-left: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--text-muted);
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
