<script setup lang="ts">
import CameraTestButton from './components/CameraTestButton.vue'
import PresetGrid from './components/PresetGrid.vue'
</script>

<template>
  <main class="app">
    <header class="hero">
      <h1>Panasonic Remote Control</h1>
      <p>Envoyez une commande simple pour vérifier la connexion avec la caméra.</p>
    </header>
    <div class="actions">
      <CameraTestButton />
    </div>
    <PresetGrid />
  </main>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2.5rem;
  text-align: center;
  padding: 3rem 1.5rem 4rem;
}

.hero {
  max-width: 36rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.hero h1 {
  font-size: clamp(2rem, 4vw, 2.75rem);
  margin: 0;
}

.hero p {
  color: #6b7280;
  margin: 0;
}

.actions {
  display: flex;
  justify-content: center;
}
</style>
