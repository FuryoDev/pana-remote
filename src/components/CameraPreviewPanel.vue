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
const LIVE_MIRROR_URL = `${CAMERA_HOST}/live/index.html`
const isTestingControls = ref(false)
const testMessage = ref<string | null>(null)
const testLog = ref<string[]>([])

const isLiveCamera = computed(() => props.camera?.id === 'cam-01')
const isCameraOnline = computed(() => props.camera?.status === 'online')
const shouldStream = computed(() => isLiveCamera.value && isCameraOnline.value)
const overlayMessage = computed(() => {
  if (!isCameraOnline.value) return 'Caméra hors ligne'
  if (!shouldStream.value) return 'Flux indisponible'
  return null
})

const mirrorSrc = computed(() => {
  if (!shouldStream.value) return null
  return `${LIVE_MIRROR_URL}?t=${Date.now()}`
})

const statusLabel = computed(() => {
  if (!props.camera) return 'Aucune caméra sélectionnée'
  return props.camera.status === 'online' ? 'Connectée' : 'Hors-ligne'
})

function handleSurfaceClick() {
  isSurfaceAlert.value = !isSurfaceAlert.value
  emit('surface-click')
}

function wait(delay: number) {
  return new Promise((resolve) => setTimeout(resolve, delay))
}

async function runControlTest() {
  if (isTestingControls.value) return

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

watch(
  shouldStream,
  (value) => {
    if (value) {
      triggerCamera('start')
    } else {
      triggerCamera('stop')
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  triggerCamera('stop')
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
          <div v-if="isLiveCamera" class="preview-panel__stream">
            <iframe
              v-if="mirrorSrc"
              class="preview-panel__mirror"
              :src="mirrorSrc"
              title="Flux caméra Panasonic"
              allowfullscreen
              loading="lazy"
            />
            <div v-else-if="overlayMessage" class="preview-panel__overlay">{{ overlayMessage }}</div>
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
  background: #000;
  display: flex;
  align-items: stretch;
  justify-content: center;
}

/* Optionnel : effet shimmer pendant le chargement si la classe is-loading est ajoutée */
.preview-panel__stream.is-loading::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    120deg,
    rgba(15, 23, 42, 0.85),
    rgba(30, 41, 59, 0.3),
    rgba(15, 23, 42, 0.85)
  );
  animation: shimmer 1.25s infinite;
  pointer-events: none;
}

.preview-panel__mirror {
  width: 100%;
  height: 100%;
  border: 0;
  object-fit: contain;
  opacity: 0;
  transition: opacity 120ms ease;
}

/* Passez l’iframe à l’état visible lorsque l’événement load est géré côté script */
.preview-panel__mirror.is-active {
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

.preview-panel__actions {
  position: absolute;
  bottom: 1.5rem;
  right: 1.5rem;
  display: flex;
  gap: 0.5rem;
}

.preview-panel__actions button {
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 999px;
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 600;
  letter-spacing: 0.05em;
  padding: 0.45rem 1.1rem;
  text-transform: uppercase;
  transition: transform 0.18s ease, background 0.18s ease;
}

.preview-panel__actions button:hover {
  transform: translateY(-1px);
  background: rgba(30, 41, 59, 0.95);
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
  font-size: 0.9rem;
  color: var(--text-primary);
}

@keyframes shimmer {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}
</style>
