<script setup lang="ts">
import { computed, ref } from 'vue'
import CameraTestButton from './components/CameraTestButton.vue'
import StreamPreviewPanel from './components/StreamPreviewPanel.vue'

type StreamProtocol = 'rtmp' | 'srt' | 'ts'

const protocolOptions: StreamProtocol[] = ['rtmp', 'srt', 'ts']
const selectedProtocol = ref<StreamProtocol>('rtmp')
const isStreaming = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

const streamingLabel = computed(() => (isStreaming.value ? 'Streaming' : 'Idle'))

async function sendStreamCommand(command: 'start' | 'stop') {
  errorMessage.value = null
  isLoading.value = true

  try {
    const response = await fetch(
      `/api/stream/${selectedProtocol.value}/${command}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body?.error || 'Unable to control stream')
    }

    isStreaming.value = command === 'start'
  } catch (error: any) {
    errorMessage.value = error.message || String(error)
  } finally {
    isLoading.value = false
  }
}

function handleProtocolChange(event: Event) {
  const target = event.target as HTMLSelectElement | null
  if (!target) return
  selectedProtocol.value = target.value as StreamProtocol
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
          :disabled="isLoading || isStreaming"
          :aria-pressed="isStreaming"
          @click="sendStreamCommand('start')"
        >
          <span v-if="isLoading && !isStreaming" class="loader" aria-hidden="true" />
          <span>{{ isStreaming ? 'Streaming…' : 'Start stream' }}</span>
        </button>
        <button
          type="button"
          class="action-button stop"
          :disabled="isLoading || !isStreaming"
          :aria-pressed="!isStreaming"
          @click="sendStreamCommand('stop')"
        >
          <span v-if="isLoading && isStreaming" class="loader" aria-hidden="true" />
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
  align-items: stretch;
  gap: 1.5rem;
  text-align: left;
}

@media (min-width: 768px) {
  .app-header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
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
