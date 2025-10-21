<script setup lang="ts">
import { computed, toRefs } from 'vue'
import type { CameraStatusResponse } from '../types/camera'

const props = defineProps<{
  status: CameraStatusResponse | null
  isLoading: boolean
  error: string | null
  lastUpdated: number | null
}>()

const { status, isLoading, error, lastUpdated } = toRefs(props)

const emit = defineEmits<{ (e: 'retry'): void }>()

const streamingLines = computed(() => {
  if (!status.value?.streaming) {
    return []
  }

  return status.value.streaming
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
})

const lastUpdatedText = computed(() => {
  if (!lastUpdated.value) {
    return null
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(lastUpdated.value))
})
</script>

<template>
  <section class="status-panel">
    <header>
      <h2>Statut de la caméra</h2>
      <button type="button" class="retry" @click="emit('retry')" :disabled="isLoading">
        {{ isLoading ? 'Actualisation…' : 'Rafraîchir' }}
      </button>
    </header>

    <p v-if="isLoading && !status" class="hint">Chargement du statut…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <dl v-if="status" class="status-details">
      <div>
        <dt>UID</dt>
        <dd>{{ status.uid }}</dd>
      </div>
      <div>
        <dt>État du flux</dt>
        <dd>
          <template v-if="streamingLines.length">
            <span v-for="line in streamingLines" :key="line">{{ line }}</span>
          </template>
          <span v-else>Indisponible</span>
        </dd>
      </div>
      <div v-if="lastUpdatedText">
        <dt>Dernière mise à jour</dt>
        <dd>{{ lastUpdatedText }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.status-panel {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

h2 {
  margin: 0;
  font-size: 1.1rem;
}

.retry {
  appearance: none;
  background: #111827;
  color: #fff;
  border: none;
  border-radius: 9999px;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
}

.retry:hover:not(:disabled) {
  background: #0f172a;
  transform: translateY(-1px);
}

.retry:disabled {
  opacity: 0.65;
  cursor: progress;
}

.status-details {
  display: grid;
  gap: 0.85rem;
}

.status-details div {
  display: grid;
  gap: 0.25rem;
}

dt {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
}

dd {
  margin: 0;
  font-size: 0.95rem;
  color: #111827;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.hint {
  color: #6b7280;
  font-size: 0.95rem;
}

.error {
  color: #dc2626;
  font-weight: 500;
}
</style>
