<script setup lang="ts">
import CameraTestButton from './components/CameraTestButton.vue'
</script>

<template>
  <main class="app">
    <header>
      <h1>Panasonic Remote Control</h1>
      <p>Envoyez une commande simple pour vérifier la connexion avec la caméra.</p>
    </header>
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
