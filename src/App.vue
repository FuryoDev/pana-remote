<script setup lang="ts">
import CameraStatusPanel from './components/CameraStatusPanel.vue'
import CameraStreamPanel from './components/CameraStreamPanel.vue'
import CameraTestButton from './components/CameraTestButton.vue'
import PresetGrid from './components/PresetGrid.vue'
import { useCameraStatus } from './composables/useCameraStatus'

const { status, isLoading, error, lastUpdated, refresh } = useCameraStatus()
</script>

<template>
  <main class="app">
    <header class="app__header">
      <div>
        <h1>Panasonic Remote Control</h1>
        <p>
          Préparez vos tests de communication : vérifiez la connexion, gérez les presets et pilotez le flux
          vidéo.
        </p>
      </div>
      <CameraTestButton />
    </header>

    <CameraStatusPanel
      :status="status"
      :is-loading="isLoading"
      :error="error"
      :last-updated="lastUpdated"
      @retry="refresh"
    />

    <section class="app__grid">
      <CameraStreamPanel :status="status" @refresh="refresh" />
      <PresetGrid />
    </section>
  </main>
</template>

<style scoped>
.app {
  min-height: 100vh;
  padding: clamp(1.5rem, 4vw, 3rem);
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.app__header {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .app__header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

h1 {
  margin: 0 0 0.5rem;
  font-size: clamp(2rem, 4vw, 2.75rem);
}

p {
  margin: 0;
  color: #6b7280;
  max-width: 36rem;
  line-height: 1.6;
}

.app__grid {
  display: grid;
  gap: 1.5rem;
}

@media (min-width: 960px) {
  .app__grid {
    grid-template-columns: 1.1fr 0.9fr;
  }
}
</style>
