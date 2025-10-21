<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import type { CameraStatusResponse, StreamProtocol } from '../types/camera'

const props = defineProps<{
  status: CameraStatusResponse | null
}>()

const emit = defineEmits<{ (e: 'refresh'): void }>()

const protocol = ref<StreamProtocol>('rtmp')
const isSubmitting = ref(false)
const feedback = ref<string | null>(null)
const feedbackTone = ref<'success' | 'error'>('success')

const streamingDescription = computed(() => {
  const raw = props.status?.streaming?.trim()
  if (!raw) {
    return ['Flux inactif']
  }

  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
})

async function sendCommand(command: 'start' | 'stop') {
  if (isSubmitting.value) {
    return
  }

  feedback.value = null
  isSubmitting.value = true

  try {
    const response = await fetch(`/api/stream/${protocol.value}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload.error ?? `HTTP ${response.status}`)
    }

    feedbackTone.value = 'success'
    feedback.value = command === 'start' ? 'Flux démarré' : 'Flux arrêté'
    emit('refresh')
  } catch (error: any) {
    feedbackTone.value = 'error'
    feedback.value = error?.message ?? 'Commande refusée'
  } finally {
    isSubmitting.value = false
  }
}

watchEffect((onCleanup) => {
  if (!feedback.value) {
    return
  }

  const timer = setTimeout(() => {
    feedback.value = null
  }, 2500)

  onCleanup(() => clearTimeout(timer))
})
</script>

<template>
  <section class="stream-panel">
    <header>
      <h2>Prévisualisation du flux</h2>
      <p class="status-line">
        <span v-for="line in streamingDescription" :key="line">{{ line }}</span>
      </p>
    </header>

    <div class="preview">
      <div class="preview-surface">
        <p>Prévisualisation vidéo à intégrer</p>
      </div>
    </div>

    <div class="controls">
      <label>
        Protocole
        <select v-model="protocol">
          <option value="rtmp">RTMP</option>
          <option value="srt">SRT</option>
          <option value="ts">MPEG-TS</option>
        </select>
      </label>

      <div class="buttons">
        <button type="button" @click="sendCommand('start')" :disabled="isSubmitting">
          {{ isSubmitting ? 'Envoi…' : 'Démarrer' }}
        </button>
        <button type="button" class="secondary" @click="sendCommand('stop')" :disabled="isSubmitting">
          Arrêter
        </button>
      </div>
    </div>

    <p v-if="feedback" class="feedback" :class="feedbackTone">{{ feedback }}</p>
  </section>
</template>

<style scoped>
.stream-panel {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
}

header {
  display: grid;
  gap: 0.4rem;
}

h2 {
  margin: 0;
  font-size: 1.1rem;
}

.status-line {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  color: #6b7280;
  font-size: 0.9rem;
  margin: 0;
}

.preview {
  position: relative;
  border-radius: 1rem;
  overflow: hidden;
  background: radial-gradient(circle at center, rgba(79, 70, 229, 0.15), transparent);
  border: 1px dashed rgba(79, 70, 229, 0.4);
}

.preview-surface {
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4f46e5;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 0.85rem;
  background: rgba(79, 70, 229, 0.05);
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}

label {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
  gap: 0.35rem;
}

select {
  border-radius: 0.75rem;
  border: 1px solid #cbd5f5;
  padding: 0.45rem 0.75rem;
  font-size: 0.95rem;
  background: #f8fafc;
  color: #1f2937;
}

.buttons {
  display: flex;
  gap: 0.75rem;
}

button {
  appearance: none;
  border: none;
  border-radius: 9999px;
  font-weight: 600;
  font-size: 0.95rem;
  padding: 0.55rem 1.4rem;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease, background 0.2s ease;
}

button:first-of-type {
  background: #2563eb;
  color: #fff;
}

button.secondary {
  background: #e5e7eb;
  color: #1f2937;
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
}

button:disabled {
  opacity: 0.65;
  cursor: progress;
}

.feedback {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 500;
}

.feedback.success {
  color: #0f766e;
}

.feedback.error {
  color: #b91c1c;
}
</style>
