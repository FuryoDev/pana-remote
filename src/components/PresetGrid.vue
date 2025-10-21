<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'

type AsyncState = 'idle' | 'loading' | 'success' | 'error'

type TileState = {
  thumbnailStatus: AsyncState
  thumbnailUrl: string | null
  thumbnailError: string | null
  thumbnailToken: symbol | null
  recallStatus: AsyncState
  recallMessage: string
}

const PRESET_COUNT = 12
const presets = Array.from({ length: PRESET_COUNT }, (_, index) => index + 1)

const tileStates = reactive<Record<number, TileState>>({})
const revokeQueue = new Set<string>()

for (const preset of presets) {
  tileStates[preset] = {
    thumbnailStatus: 'loading',
    thumbnailUrl: null,
    thumbnailError: null,
    thumbnailToken: null,
    recallStatus: 'idle',
    recallMessage: '',
  }
}

const tiles = computed(() => presets.map((preset) => ({ preset, state: tileStates[preset]! })))

async function loadThumbnail(preset: number) {
  const state = tileStates[preset]
  if (!state) return

  const token = Symbol(`preset-${preset}`)
  state.thumbnailToken = token
  state.thumbnailStatus = 'loading'
  state.thumbnailError = null

  try {
    const response = await fetch(`/api/preset/${preset}/thumbnail?t=${Date.now()}`)

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.error ?? `HTTP ${response.status}`)
    }

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)

    if (state.thumbnailToken !== token) {
      revokeQueue.add(objectUrl)
      flushRevokeQueue()
      return
    }

    if (state.thumbnailUrl) {
      revokeQueue.add(state.thumbnailUrl)
    }

    state.thumbnailUrl = objectUrl
    state.thumbnailStatus = 'success'
    state.thumbnailToken = null
    flushRevokeQueue()
  } catch (error: any) {
    if (state.thumbnailToken !== token) {
      return
    }

    state.thumbnailStatus = 'error'
    state.thumbnailError = error?.message ?? 'Impossible de charger la vignette'
    state.thumbnailToken = null
  }
}

async function recallPreset(preset: number) {
  const state = tileStates[preset]
  if (!state || state.recallStatus === 'loading') return

  state.recallStatus = 'loading'
  state.recallMessage = ''

  try {
    const response = await fetch('/api/preset/recall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ n: preset }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload.error ?? `HTTP ${response.status}`)
    }

    state.recallStatus = 'success'
    state.recallMessage = payload.message ?? `Preset ${preset} rappelé`
  } catch (error: any) {
    state.recallStatus = 'error'
    state.recallMessage = error?.message ?? 'Échec du rappel du preset'
  } finally {
    if (state.recallStatus !== 'loading') {
      const finalStatus = state.recallStatus
      setTimeout(() => {
        if (state.recallStatus === finalStatus) {
          if (finalStatus === 'success') {
            state.recallMessage = ''
          }
          state.recallStatus = 'idle'
        }
      }, 2500)
    }
  }
}

function handleRetry(preset: number) {
  loadThumbnail(preset)
}

function flushRevokeQueue() {
  for (const url of revokeQueue) {
    URL.revokeObjectURL(url)
  }
  revokeQueue.clear()
}

onMounted(() => {
  presets.forEach((preset) => {
    loadThumbnail(preset)
  })
})

onBeforeUnmount(() => {
  presets.forEach((preset) => {
    const existing = tileStates[preset]?.thumbnailUrl
    if (existing) {
      revokeQueue.add(existing)
    }
  })
  flushRevokeQueue()
})
</script>

<template>
  <section class="preset-section">
    <div class="section-header">
      <h2>Préréglages caméra</h2>
      <p>Rappelez un préréglage en un clic et visualisez son aperçu en temps réel.</p>
    </div>

    <div class="preset-grid">
      <article
        v-for="{ preset, state } in tiles"
        :key="preset"
        class="preset-card"
        :class="{
          success: state.recallStatus === 'success',
          error: state.recallStatus === 'error',
        }"
      >
        <button
          type="button"
          class="preset-button"
          @click="recallPreset(preset)"
          :disabled="state.recallStatus === 'loading'"
        >
          <div class="thumbnail">
            <div v-if="state.thumbnailStatus === 'loading'" class="thumbnail-state loading">
              Chargement…
            </div>
            <div v-else-if="state.thumbnailStatus === 'error'" class="thumbnail-state error">
              <span>{{ state.thumbnailError ?? 'Erreur de chargement' }}</span>
              <button type="button" class="retry" @click.stop="handleRetry(preset)">
                Réessayer
              </button>
            </div>
            <img
              v-else
              :src="state.thumbnailUrl ?? ''"
              :alt="`Aperçu du préréglage ${preset}`"
            />
          </div>
          <span class="preset-label">
            Preset {{ preset }}
            <span v-if="state.recallStatus === 'loading'" class="status-tag">Rappel…</span>
          </span>
        </button>
        <p v-if="state.recallMessage" :class="['feedback', state.recallStatus]">
          {{ state.recallMessage }}
        </p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.preset-section {
  width: min(960px, 100%);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  text-align: left;
}

.section-header h2 {
  font-size: clamp(1.5rem, 2.5vw, 2rem);
  margin: 0;
}

.section-header p {
  color: #6b7280;
  margin: 0;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.preset-card {
  background: #fff;
  border-radius: 0.75rem;
  padding: 1rem;
  box-shadow: 0 12px 24px -20px rgba(15, 23, 42, 0.45);
  border: 1px solid transparent;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.preset-card.success {
  border-color: #10b981;
}

.preset-card.error {
  border-color: #ef4444;
}

.preset-button {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: stretch;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
}

.preset-button:disabled {
  cursor: progress;
}

.thumbnail {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 0.65rem;
  overflow: hidden;
  background: linear-gradient(135deg, #e5e7eb, #f3f4f6);
  display: grid;
  place-items: center;
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-state {
  display: grid;
  place-items: center;
  text-align: center;
  padding: 1rem;
  color: #4b5563;
  font-size: 0.95rem;
  gap: 0.5rem;
}

.thumbnail-state.error {
  color: #b91c1c;
}

.thumbnail-state .retry {
  background: #1f2937;
  color: #fff;
  border: none;
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.thumbnail-state .retry:hover {
  background: #111827;
}

.preset-label {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
}

.status-tag {
  background: #e0f2fe;
  color: #0369a1;
  border-radius: 999px;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.feedback {
  margin: 0;
  font-size: 0.9rem;
}

.feedback.success {
  color: #047857;
}

.feedback.error {
  color: #dc2626;
}
</style>
