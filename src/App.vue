<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CameraTestButton from './components/CameraTestButton.vue'
import StreamPreviewPanel from './components/StreamPreviewPanel.vue'
import { useCameraStatus } from './components/useCameraStatus'

/** --- Streaming controls (codex) --- */
type StreamProtocol = 'rtmp' | 'srt' | 'ts'
const protocolOptions: StreamProtocol[] = ['rtmp', 'srt', 'ts']
const selectedProtocol = ref<StreamProtocol>('rtmp')

const isStreaming = ref(false)              // piloté localement + synchronisé avec l’état caméra
const isLoadingAction = ref(false)          // chargement pour start/stop
const errorMessage = ref<string | null>(null)

const streamingLabel = computed(() => (isStreaming.value ? 'Streaming' : 'Idle'))

/** --- Camera status (main) --- */
const {
  status,
  isLoading: isLoadingStatus,  // renommé pour éviter le conflit avec les actions start/stop
  isRefreshing,
  error,
  lastUpdated,
  refresh,
} = useCameraStatus()

const formattedLastUpdated = computed(() => {
  if (!lastUpdated.value) return '—'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(lastUpdated.value)
})

const streamingState = computed(() => {
  const s = status.value?.streaming
  return typeof s === 'boolean' ? (s ? 'On' : 'Off') : 'Unknown'
})

/** Synchronise l’état local avec l’état caméra lorsqu’il arrive/évolue */
watch(
  () => status.value?.streaming,
  (val) => {
    if (typeof val === 'boolean') isStreaming.value = val
  },
  { immediate: true }
)

/** Lance/arrête le stream et rafraîchit l’état global */
async function sendStreamCommand(command: 'start' | 'stop') {
  errorMessage.value = null
  isLoadingAction.value = true
  try {
    const response = await fetch(`/api/stream/${selectedProtocol.value}/${command}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body?.error || 'Unable to control stream')
    }

    // On reflète immédiatement côté UI…
    isStreaming.value = command === 'start'
    // …et on synchronise l’état avec la caméra (source de vérité)
    await refresh()
  } catch (e: any) {
    errorMessage.value = e?.message || String(e)
  } finally {
    isLoadingAction.value = false
  }
}

function handleProtocolChange(event: Event) {
  const target = event.target as HTMLSelectElement | null
  if (!target) return
  selectedProtocol.value = target.value as StreamProtocol
  // on remet l’état visuel à neutre ; le prochain refresh donnera la vérité
  isStreaming.value = false
  errorMessage.value = null
}
</script>

<template>
  <main class="app">
    <header class="app-header">
      <div>
        <h1>Panasonic Remote Control</h1>
        <p>Envoyez une commande simple pour vérifier la connexion avec la caméra.</p>
      </div>
      <CameraTestButton />
    </header>

    <!-- Carte d’état (branche main) -->
    <section
      class="status-card"
      :class="{ 'status-card--error': error, 'status-card--loading': isLoadingStatus }"
    >
      <div class="status-card__header">
        <h2>État de la caméra</h2>
        <button
          type="button"
          class="status-card__refresh-btn"
          @click="refresh"
          :disabled="isLoadingStatus || isRefreshing"
        >
          {{ isRefreshing ? 'Actualisation…' : 'Actualiser' }}
        </button>
      </div>

      <div v-if="isLoadingStatus" class="status-card__state">Chargement de l'état…</div>
      <div v-else-if="error" class="status-card__state status-card__state--error">
        <p>Impossible de joindre la caméra.</p>
        <p class="status-card__error">{{ error }}</p>
      </div>
      <dl v-else class="status-card__details">
        <div>
          <dt>UID</dt>
          <dd>{{ status?.uid }}</dd>
        </div>
        <div>
          <dt>Streaming</dt>
          <dd>{{ streamingState }}</dd>
        </div>
        <div>
          <dt>Dernière actualisation</dt>
          <dd>{{ formattedLastUpdated }}</dd>
        </div>
      </dl>
    </section>

    <!-- Contrôles + aperçu (branche codex) -->
    <section class="controls">
      <label class="select-label">
        Protocol
        <select
          class="protocol-select"
          :value="selectedProtocol"
          @change="handleProtocolChange"
        >
          <option v-for="option in protocolOptions" :key="option" :value="option">
            {{ option.toUpperCase() }}
          </option>
        </select>
      </label>

      <div class="button-group">
        <button
          type="button"
          class="action-button start"
          :disabled="isLoadingAction || isStreaming"
          :aria-pressed="isStreaming"
          @click="sendStreamCommand('start')"
        >
          <span v-if="isLoadingAction && !isStreaming" class="loader" aria-hidden="true" />
          <span>{{ isStreaming ? 'Streaming…' : 'Start stream' }}</span>
        </button>
        <button
          type="button"
          class="action-button stop"
          :disabled="isLoadingAction || !isStreaming"
          :aria-pressed="!isStreaming"
          @click="sendStreamCommand('stop')"
        >
          <span v-if="isLoadingAction && isStreaming" class="loader" aria-hidden="true" />
          <span>{{ isStreaming ? 'Stop stream' : 'Stopped' }}</span>
        </button>
      </div>
    </section>

    <StreamPreviewPanel
      :protocol="selectedProtocol"
      :is-streaming="isStreaming"
      :error-message="errorMessage"
    >
      <template #default>
        <video
          v-if="isStreaming"
          class="preview-video"
          autoplay
          muted
          playsinline
          controls
        >
          <track kind="captions" label="No preview" />
        </video>
        <img
          v-else
          class="preview-image"
          src="/preview-placeholder.svg"
          alt="Camera preview placeholder"
        />
      </template>
    </StreamPreviewPanel>

    <footer class="status">
      <span class="status-indicator" :class="{ active: isStreaming }" aria-hidden="true" />
      <span class="status-text">
        {{ selectedProtocol.toUpperCase() }} · {{ streamingLabel }}
      </span>
    </footer>
  </main>
</template>

<style scoped>
.app {
  min-height: 100vh;
  max-width: 960px;
  margin: 0 auto;
  padding: 3rem 1.5rem;
  display: grid;
  gap: 2.5rem;
  color: #111827;
}

.app-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  text-align: center;
  padding: 2rem;
  background: #f9fafb;
}

header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.status-card {
  width: min(100%, 28rem);
  background: #ffffff;
  border-radius: 1rem;
  border: 1px solid rgba(15, 118, 110, 0.15);
  box-shadow: 0 20px 50px -20px rgba(13, 148, 136, 0.3);
  padding: 1.75rem;
  text-align: left;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.status-card--error {
  border-color: rgba(220, 38, 38, 0.4);
  box-shadow: 0 20px 50px -20px rgba(220, 38, 38, 0.25);
}

.status-card--loading {
  opacity: 0.75;
}

.status-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.status-card__refresh-btn {
  padding: 0.35rem 0.9rem;
  border-radius: 9999px;
  border: none;
  background: #0f766e;
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.2s ease;
}

.status-card__refresh-btn:disabled {
  cursor: not-allowed;
  background: #94a3b8;
}

.status-card__refresh-btn:not(:disabled):hover {
  background: #0d9488;
}

.status-card__refresh-btn:not(:disabled):active {
  transform: scale(0.98);
}

.status-card__state {
  font-size: 0.95rem;
  color: #0f172a;
}

.status-card__state--error {
  color: #b91c1c;
}

.status-card__error {
  font-size: 0.85rem;
  margin-top: 0.25rem;
  color: #7f1d1d;
}

.status-card__details {
  display: grid;
  gap: 1rem;
}

.status-card__details div {
  display: grid;
  gap: 0.35rem;
}

.status-card__details dt {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.status-card__details dd {
  margin: 0;
  font-size: 1.05rem;
  color: #0f172a;
  font-weight: 600;
}

h1 {
  font-size: clamp(2rem, 5vw, 2.75rem);
  margin-bottom: 0.5rem;
}

p {
  color: #6b7280;
  max-width: 32rem;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: flex-start;
}

.select-label {
  font-weight: 600;
  color: #374151;
  display: grid;
  gap: 0.5rem;
}

.protocol-select {
  appearance: none;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid #d1d5db;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  background: linear-gradient(135deg, #f9fafb, #eef2ff);
  color: #111827;
  min-width: 180px;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.protocol-select:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.action-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.85rem 1.75rem;
  border-radius: 999px;
  border: none;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  color: #ffffff;
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-button.start {
  background: linear-gradient(135deg, #34d399, #059669);
  box-shadow: 0 12px 20px rgba(16, 185, 129, 0.25);
}

.action-button.stop {
  background: linear-gradient(135deg, #f87171, #dc2626);
  box-shadow: 0 12px 20px rgba(248, 113, 113, 0.25);
}

.action-button:not(:disabled):active {
  transform: translateY(1px);
}

.loader {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.6);
  border-top-color: #fff;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.preview-video,
.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 600;
  color: #4b5563;
}

.status-indicator {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  background: #9ca3af;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.status-indicator.active {
  background: #34d399;
  box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.25);
}

.status-text {
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
</style>
