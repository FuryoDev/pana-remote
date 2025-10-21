<script setup lang="ts">
import { computed } from 'vue'
import CameraTestButton from './components/CameraTestButton.vue'
import { useCameraStatus } from './components/useCameraStatus'

const { status, isLoading, isRefreshing, error, lastUpdated, refresh } = useCameraStatus()

const formattedLastUpdated = computed(() => {
  if (!lastUpdated.value) return '—'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(lastUpdated.value)
})

const streamingState = computed(() => status.value?.streaming ?? 'Unknown')
</script>

<template>
  <main class="app">
    <header>
      <h1>Panasonic Remote Control</h1>
      <p>Envoyez une commande simple pour vérifier la connexion avec la caméra.</p>
    </header>

    <section
      class="status-card"
      :class="{ 'status-card--error': error, 'status-card--loading': isLoading }"
    >
      <div class="status-card__header">
        <h2>État de la caméra</h2>
        <button type="button" class="status-card__refresh-btn" @click="refresh" :disabled="isLoading || isRefreshing">
          {{ isRefreshing ? 'Actualisation…' : 'Actualiser' }}
        </button>
      </div>

      <div v-if="isLoading" class="status-card__state">Chargement de l'état…</div>
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

    <CameraTestButton />
  </main>
</template>

<style scoped>
.app {
  min-height: 100vh;
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
  font-size: clamp(2rem, 4vw, 2.75rem);
  margin-bottom: 0.5rem;
}

p {
  color: #6b7280;
  max-width: 28rem;
}
</style>
