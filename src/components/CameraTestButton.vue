<script setup lang="ts">
import { computed, ref } from 'vue'

type RequestState = 'idle' | 'loading' | 'success' | 'error'

const state = ref<RequestState>('idle')
const message = ref('')

const isLoading = computed(() => state.value === 'loading')
const statusClass = computed(() => {
  if (state.value === 'success') return 'status success'
  if (state.value === 'error') return 'status error'
  return 'status'
})

async function triggerTest() {
  state.value = 'loading'
  message.value = ''

  try {
    const response = await fetch('/api/camera/test-move', { method: 'POST' })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload.error ?? `HTTP ${response.status}`)
    }

    state.value = 'success'
    message.value = payload.message ?? 'Commande envoyée'
  } catch (error: any) {
    state.value = 'error'
    message.value = error?.message ?? 'Une erreur est survenue'
  }
}
</script>

<template>
  <div class="camera-test">
    <button type="button" @click="triggerTest" :disabled="isLoading">
      {{ isLoading ? 'Test en cours…' : 'Tester la caméra' }}
    </button>
    <p v-if="message" :class="statusClass">{{ message }}</p>
  </div>
</template>

<style scoped>
.camera-test {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
}

button {
  background: #1f2937;
  border: none;
  border-radius: 9999px;
  color: #fff;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  transition: background 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
}

button:hover:not(:disabled) {
  background: #111827;
  transform: translateY(-1px);
}

button:active:not(:disabled) {
  transform: translateY(1px);
}

button:disabled {
  cursor: progress;
  opacity: 0.6;
}

.status {
  font-size: 0.95rem;
}

.status.success {
  color: #059669;
}

.status.error {
  color: #dc2626;
}
</style>
