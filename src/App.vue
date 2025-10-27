<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PanTiltController from './components/PanTiltController.vue'
import type { PanTiltDirection, PanTiltMoveDirection } from './types/ptz'

const CAMERA_HOST = '10.41.39.153'
const cameraPreviewUrl = computed(() => `http://${CAMERA_HOST}/live/index.html`)

const isDevEnvironment =
  typeof import.meta !== 'undefined' &&
  Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV)

const activeDirection = ref<PanTiltDirection>('stop')
const directionFeedback = ref<string | null>(null)
const directionTone = ref<'success' | 'error'>('success')
const directionRequestId = ref(0)

const presetNumbers = [1, 2, 3, 4, 5, 6]
const recallingPreset = ref<number | null>(null)
const presetFeedback = ref<string | null>(null)
const presetTone = ref<'success' | 'error'>('success')
const lastPreset = ref<number | null>(null)

const directionMessages: Record<PanTiltMoveDirection, string> = {
  up: 'Déplacement vers le haut',
  down: 'Déplacement vers le bas',
  left: 'Déplacement vers la gauche',
  right: 'Déplacement vers la droite',
}

async function extractError(response: Response): Promise<string> {
  try {
    const payload = await response.clone().json()
    if (payload && typeof payload.error === 'string' && payload.error.trim().length > 0) {
      return payload.error.trim()
    }
  } catch (error) {
    if (isDevEnvironment) {
      console.warn('Unable to parse JSON error payload', error)
    }
  }

  try {
    const text = await response.text()
    if (text && text.trim().length > 0) {
      return text.trim()
    }
  } catch (error) {
    if (isDevEnvironment) {
      console.warn('Unable to read error payload', error)
    }
  }

  return `HTTP ${response.status}`
}

async function sendDirection(direction: PanTiltDirection) {
  activeDirection.value = direction
  const requestId = ++directionRequestId.value

  try {
    const response = await fetch('/api/ptz/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
    })

    if (!response.ok) {
      throw new Error(await extractError(response))
    }

    await response.text().catch(() => '')

    if (requestId !== directionRequestId.value) {
      return
    }

    directionTone.value = 'success'
    directionFeedback.value =
      direction === 'stop'
        ? 'Mouvement stoppé'
        : directionMessages[direction as PanTiltMoveDirection] ?? 'Commande envoyée'
  } catch (error: any) {
    if (requestId !== directionRequestId.value) {
      return
    }

    directionTone.value = 'error'
    directionFeedback.value = error?.message ?? 'Commande refusée'
  }
}

function handleMove(direction: PanTiltMoveDirection) {
  if (activeDirection.value === direction) {
    return
  }

  void sendDirection(direction)
}

function handleStop() {
  if (activeDirection.value === 'stop') {
    return
  }

  void sendDirection('stop')
}

async function recallPreset(preset: number) {
  recallingPreset.value = preset

  try {
    const response = await fetch('/api/preset/recall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ n: preset }),
    })

    if (!response.ok) {
      throw new Error(await extractError(response))
    }

    await response.text().catch(() => '')
    lastPreset.value = preset
    presetTone.value = 'success'
    presetFeedback.value = `Preset ${preset} rappelé`
  } catch (error: any) {
    presetTone.value = 'error'
    presetFeedback.value = error?.message ?? 'Commande refusée'
  } finally {
    recallingPreset.value = null
  }
}

watch(directionFeedback, (value) => {
  if (!value) {
    return
  }

  const timer = setTimeout(() => {
    if (directionFeedback.value === value) {
      directionFeedback.value = null
    }
  }, 2500)

  return () => clearTimeout(timer)
})

watch(presetFeedback, (value) => {
  if (!value) {
    return
  }

  const timer = setTimeout(() => {
    if (presetFeedback.value === value) {
      presetFeedback.value = null
    }
  }, 2500)

  return () => clearTimeout(timer)
})

const previewTitle = computed(() => `CAM 1 — Connexion directe (${CAMERA_HOST})`)
const previewDescription = computed(
  () => `Flux intégré depuis http://${CAMERA_HOST}/live/index.html`
)
</script>

<template>
  <div class="app">
    <header class="app__header">
      <div>
        <h1>Panasonic Remote Control</h1>
        <p>Connexion directe à la caméra réseau située à l'adresse {{ CAMERA_HOST }}.</p>
      </div>
    </header>

    <main class="app__content">
      <section class="preview">
        <header class="preview__header">
          <h2>{{ previewTitle }}</h2>
          <p>{{ previewDescription }}</p>
        </header>

        <div class="preview__surface">
          <iframe
            class="preview__iframe"
            :src="cameraPreviewUrl"
            title="Prévisualisation en direct de la caméra"
            frameborder="0"
            allow="autoplay; fullscreen"
          ></iframe>
        </div>

        <p class="preview__hint">
          Utilisez le panneau de droite pour piloter la caméra et rappeler vos presets favoris.
        </p>
      </section>

      <aside class="sidebar">
        <section class="panel">
          <header class="panel__header">
            <div>
              <h3>Contrôle caméra</h3>
              <p>Pavé directionnel simplifié</p>
            </div>
          </header>

          <PanTiltController
            class="panel__controller"
            :active-direction="activeDirection"
            @move="handleMove"
            @stop="handleStop"
          />

          <p v-if="directionFeedback" class="panel__feedback" :class="directionTone">
            {{ directionFeedback }}
          </p>
        </section>

        <section class="panel">
          <header class="panel__header">
            <div>
              <h3>Presets caméra</h3>
              <p>Rappel rapide des positions enregistrées</p>
            </div>
          </header>

          <div class="preset-grid">
            <button
              v-for="preset in presetNumbers"
              :key="preset"
              type="button"
              class="preset-grid__button"
              :class="{
                'is-active': lastPreset === preset,
              }"
              @click="recallPreset(preset)"
              :disabled="recallingPreset === preset"
            >
              <span>Preset {{ preset }}</span>
            </button>
          </div>

          <p v-if="presetFeedback" class="panel__feedback" :class="presetTone">
            {{ presetFeedback }}
          </p>
        </section>
      </aside>
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #111827;
  color: #e2e8f0;
}

.app__header {
  padding: 1.5rem 2rem 1rem;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95));
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.app__header h1 {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
}

.app__header p {
  margin: 0.35rem 0 0;
  color: rgba(226, 232, 240, 0.75);
}

.app__content {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 420px;
  gap: 2rem;
  padding: 2rem;
}

.preview {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.preview__header h2 {
  margin: 0;
  font-size: 1.3rem;
}

.preview__header p {
  margin: 0.4rem 0 0;
  color: rgba(226, 232, 240, 0.65);
}

.preview__surface {
  position: relative;
  border-radius: 1rem;
  overflow: hidden;
  background: #0f172a;
  border: 1px solid rgba(100, 116, 139, 0.35);
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.55);
}

.preview__iframe {
  width: 100%;
  aspect-ratio: 16 / 9;
  border: none;
  background: #0b1120;
}

.preview__hint {
  margin: 0;
  font-size: 0.95rem;
  color: rgba(226, 232, 240, 0.7);
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.panel {
  background: rgba(15, 23, 42, 0.85);
  border-radius: 1.25rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: 0 15px 35px rgba(15, 23, 42, 0.6);
}

.panel__header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.panel__header p {
  margin: 0.35rem 0 0;
  color: rgba(148, 163, 184, 0.9);
  font-size: 0.9rem;
}

.panel__controller {
  align-self: center;
}

.panel__feedback {
  margin: 0;
  font-size: 0.9rem;
  padding: 0.6rem 0.75rem;
  border-radius: 0.75rem;
  background: rgba(148, 163, 184, 0.1);
}

.panel__feedback.success {
  color: #bbf7d0;
  background: rgba(34, 197, 94, 0.2);
}

.panel__feedback.error {
  color: #fecaca;
  background: rgba(248, 113, 113, 0.2);
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.preset-grid__button {
  appearance: none;
  border: none;
  border-radius: 1rem;
  padding: 0.85rem 1rem;
  background: rgba(30, 41, 59, 0.85);
  color: #e2e8f0;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2);
}

.preset-grid__button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.preset-grid__button:not(:disabled):hover {
  background: rgba(37, 99, 235, 0.35);
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.6);
}

.preset-grid__button.is-active {
  background: rgba(37, 99, 235, 0.65);
  box-shadow: inset 0 0 0 1px rgba(191, 219, 254, 0.7);
}

@media (max-width: 1200px) {
  .app__content {
    grid-template-columns: 1fr;
  }

  .sidebar {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .panel {
    flex: 1 1 280px;
  }
}

@media (max-width: 768px) {
  .app__content {
    padding: 1.5rem;
  }

  .sidebar {
    flex-direction: column;
  }
}
</style>
