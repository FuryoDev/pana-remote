<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { CameraInfoResponse } from './types/camera'

type PanTiltDirection = 'up' | 'down' | 'left' | 'right' | 'stop'
type MovementDirection = Exclude<PanTiltDirection, 'stop'>

const cameraUrl = 'http://10.41.39.153/live/index.html'

const cameraInfo = ref<CameraInfoResponse | null>(null)
const infoLoading = ref(true)
const infoError = ref<string | null>(null)

const activeDirection = ref<PanTiltDirection | null>(null)
const controlError = ref<string | null>(null)
const isCommandPending = ref(false)

const presets = [1, 2, 3, 4, 5, 6]
const presetBusy = ref<number | null>(null)
const presetMessage = ref<string | null>(null)
const presetError = ref<string | null>(null)

let commandQueue: Promise<void> = Promise.resolve()
let pointerActive = false
const tapTimers = new Set<number>()
let presetTimer: number | null = null

const cameraLabel = computed(() => cameraInfo.value?.cameraTitle?.trim() || 'Cam 1')
const cameraModel = computed(() => cameraInfo.value?.modelName?.trim() || 'Panasonic PTZ')
const cameraSummary = computed(() => {
  if (!cameraInfo.value) return ''
  const parts: string[] = []
  if (cameraInfo.value.serialNumber) {
    parts.push(`S/N ${cameraInfo.value.serialNumber}`)
  }
  if (cameraInfo.value.macAddress) {
    parts.push(`MAC ${cameraInfo.value.macAddress}`)
  }
  return parts.join(' · ')
})

async function fetchCameraInfo() {
  infoLoading.value = true
  infoError.value = null

  try {
    const response = await fetch('/api/camera/info', {
      headers: { 'Cache-Control': 'no-store' },
    })
    const text = await response.text()

    if (!response.ok) {
      let message = `HTTP ${response.status}`
      if (text) {
        try {
          const parsed = JSON.parse(text)
          if (parsed && typeof parsed === 'object' && 'error' in parsed && parsed.error) {
            message = String(parsed.error)
          } else {
            message = text
          }
        } catch {
          message = text
        }
      }
      throw new Error(message)
    }

    try {
      cameraInfo.value = JSON.parse(text) as CameraInfoResponse
    } catch {
      throw new Error('Format de réponse inattendu pour les informations caméra')
    }
  } catch (error) {
    cameraInfo.value = null
    infoError.value =
      error instanceof Error
        ? error.message
        : "Impossible de récupérer les informations de la caméra"
  } finally {
    infoLoading.value = false
  }
}

function enqueuePanTilt(direction: PanTiltDirection, speed?: number) {
  const payload: Record<string, unknown> = { direction }
  if (typeof speed === 'number' && Number.isFinite(speed)) {
    payload.speed = speed
  }

  commandQueue = commandQueue
    .catch(() => {
      /* swallow previous errors to keep queue flowing */
    })
    .then(async () => {
      isCommandPending.value = true
      controlError.value = null

      try {
        const response = await fetch('/api/camera/pan-tilt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const text = await response.text().catch(() => '')
          let message = `HTTP ${response.status}`

          if (text) {
            try {
              const parsed = JSON.parse(text)
              if (parsed && typeof parsed === 'object' && 'error' in parsed && parsed.error) {
                message = String(parsed.error)
              } else if (typeof parsed === 'string') {
                message = parsed
              } else {
                message = text
              }
            } catch {
              message = text
            }
          }

          throw new Error(message)
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Impossible d'envoyer la commande PTZ"
        controlError.value = message
        throw error
      } finally {
        isCommandPending.value = false
      }
    })

  return commandQueue
}

function handlePointerDown(direction: MovementDirection, event: PointerEvent) {
  pointerActive = true
  ;(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId)
  activeDirection.value = direction
  enqueuePanTilt(direction).catch(() => {})
}

function handlePointerUp(event: PointerEvent) {
  ;(event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId)
  activeDirection.value = null
  enqueuePanTilt('stop').catch(() => {})
  window.setTimeout(() => {
    pointerActive = false
  }, 0)
}

function handlePointerCancel() {
  activeDirection.value = null
  pointerActive = false
  enqueuePanTilt('stop').catch(() => {})
}

function handlePointerLeave(event: PointerEvent) {
  if ((event.buttons ?? 0) === 0) {
    return
  }

  activeDirection.value = null
  pointerActive = false
  enqueuePanTilt('stop').catch(() => {})
}

function handleKeyboardClick(direction: MovementDirection) {
  if (pointerActive) {
    return
  }

  activeDirection.value = direction

  const command = enqueuePanTilt(direction).catch(() => {})
  command.finally(() => {
    const timer = window.setTimeout(() => {
      activeDirection.value = null
      enqueuePanTilt('stop').catch(() => {})
      tapTimers.delete(timer)
    }, 220)

    tapTimers.add(timer)
  })
}

function handleStopClick() {
  activeDirection.value = null
  pointerActive = false
  enqueuePanTilt('stop').catch(() => {})
}

function clearPresetTimer() {
  if (presetTimer) {
    window.clearTimeout(presetTimer)
    presetTimer = null
  }
}

function schedulePresetFeedbackClear() {
  clearPresetTimer()
  presetTimer = window.setTimeout(() => {
    presetMessage.value = null
    presetError.value = null
    presetTimer = null
  }, 2600)
}

async function recallPreset(preset: number) {
  if (presetBusy.value !== null) {
    return
  }

  presetBusy.value = preset
  presetMessage.value = null
  presetError.value = null

  try {
    const response = await fetch('/api/preset/recall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ n: preset }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      let message = `HTTP ${response.status}`

      if (text) {
        try {
          const parsed = JSON.parse(text)
          if (parsed && typeof parsed === 'object' && 'error' in parsed && parsed.error) {
            message = String(parsed.error)
          } else if (typeof parsed === 'string') {
            message = parsed
          } else {
            message = text
          }
        } catch {
          message = text
        }
      }

      throw new Error(message)
    }

    presetMessage.value = `Preset ${preset} rappelé`
  } catch (error) {
    presetError.value =
      error instanceof Error ? error.message : 'Impossible de rappeler le preset'
  } finally {
    presetBusy.value = null
    schedulePresetFeedbackClear()
  }
}

function refreshInfo() {
  void fetchCameraInfo()
}

onMounted(() => {
  fetchCameraInfo().catch((error) => {
    console.error('Camera info fetch failed', error)
  })
})

onUnmounted(() => {
  tapTimers.forEach((timer) => {
    clearTimeout(timer)
  })
  tapTimers.clear()
  clearPresetTimer()
})
</script>

<template>
  <main class="camera-app">
    <header class="camera-app__header">
      <div>
        <h1>{{ cameraLabel }}</h1>
        <p>
          Contrôle simplifié de la caméra Panasonic via l'interface réseau. Utilisez le joystick pour
          piloter l'orientation et déclenchez les presets essentiels.
        </p>
      </div>
      <div class="camera-app__header-status">
        <span class="camera-app__model">{{ cameraModel }}</span>
        <button type="button" class="ghost" :disabled="infoLoading" @click="refreshInfo">
          {{ infoLoading ? 'Chargement…' : 'Rafraîchir' }}
        </button>
      </div>
    </header>

    <p v-if="infoError" class="camera-app__alert">{{ infoError }}</p>

    <section class="camera-app__content">
      <div class="camera-feed">
        <div class="camera-feed__viewport">
          <iframe
            title="Flux caméra Panasonic"
            :src="cameraUrl"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          ></iframe>
        </div>
        <footer class="camera-feed__footer">
          <span class="camera-feed__label">Source</span>
          <code class="camera-feed__url">{{ cameraUrl }}</code>
        </footer>
        <ul v-if="cameraSummary" class="camera-feed__meta">
          <li>{{ cameraSummary }}</li>
        </ul>
      </div>

      <aside class="camera-sidebar">
        <section class="control-card">
          <header class="control-card__header">
            <h2>Contrôle PTZ</h2>
            <span v-if="isCommandPending" class="control-card__badge">Commande en cours…</span>
          </header>

          <div class="joystick">
            <span class="joystick__spacer" aria-hidden="true"></span>
            <button
              type="button"
              class="joystick__button"
              :class="{ 'is-active': activeDirection === 'up' }"
              aria-label="Déplacer vers le haut"
              @pointerdown.prevent="handlePointerDown('up', $event)"
              @pointerup.prevent="handlePointerUp($event)"
              @pointerleave="handlePointerLeave"
              @pointercancel="handlePointerCancel"
              @lostpointercapture="handlePointerCancel"
              @click.prevent="handleKeyboardClick('up')"
            >
              ▲
            </button>
            <span class="joystick__spacer" aria-hidden="true"></span>

            <button
              type="button"
              class="joystick__button"
              :class="{ 'is-active': activeDirection === 'left' }"
              aria-label="Déplacer vers la gauche"
              @pointerdown.prevent="handlePointerDown('left', $event)"
              @pointerup.prevent="handlePointerUp($event)"
              @pointerleave="handlePointerLeave"
              @pointercancel="handlePointerCancel"
              @lostpointercapture="handlePointerCancel"
              @click.prevent="handleKeyboardClick('left')"
            >
              ◀
            </button>
            <button
              type="button"
              class="joystick__button joystick__button--center"
              :class="{ 'is-active': activeDirection === 'stop' }"
              aria-label="Arrêter le mouvement"
              @click.prevent="handleStopClick"
            >
              ■
            </button>
            <button
              type="button"
              class="joystick__button"
              :class="{ 'is-active': activeDirection === 'right' }"
              aria-label="Déplacer vers la droite"
              @pointerdown.prevent="handlePointerDown('right', $event)"
              @pointerup.prevent="handlePointerUp($event)"
              @pointerleave="handlePointerLeave"
              @pointercancel="handlePointerCancel"
              @lostpointercapture="handlePointerCancel"
              @click.prevent="handleKeyboardClick('right')"
            >
              ▶
            </button>

            <span class="joystick__spacer" aria-hidden="true"></span>
            <button
              type="button"
              class="joystick__button"
              :class="{ 'is-active': activeDirection === 'down' }"
              aria-label="Déplacer vers le bas"
              @pointerdown.prevent="handlePointerDown('down', $event)"
              @pointerup.prevent="handlePointerUp($event)"
              @pointerleave="handlePointerLeave"
              @pointercancel="handlePointerCancel"
              @lostpointercapture="handlePointerCancel"
              @click.prevent="handleKeyboardClick('down')"
            >
              ▼
            </button>
            <span class="joystick__spacer" aria-hidden="true"></span>
          </div>

          <p v-if="controlError" class="control-card__error">{{ controlError }}</p>
        </section>

        <section class="preset-card">
          <header class="preset-card__header">
            <h2>Presets rapides</h2>
            <p>Rappels directs des positions essentielles de la caméra.</p>
          </header>

          <div class="preset-card__grid">
            <button
              v-for="preset in presets"
              :key="preset"
              type="button"
              class="preset-card__button"
              :class="{ 'is-loading': presetBusy === preset }"
              :disabled="presetBusy !== null && presetBusy !== preset"
              @click="recallPreset(preset)"
            >
              <span>Preset {{ preset }}</span>
            </button>
          </div>

          <p v-if="presetMessage" class="preset-card__feedback">{{ presetMessage }}</p>
          <p v-else-if="presetError" class="preset-card__error">{{ presetError }}</p>
        </section>
      </aside>
    </section>
  </main>
</template>

<style scoped>
:global(:root) {
  color-scheme: dark;
  --bg-app: #020617;
  --surface: #0f172a;
  --surface-raised: #111c2e;
  --surface-highlight: #1d2b4a;
  --border: #1f2a44;
  --border-strong: #334155;
  --text-primary: #e2e8f0;
  --text-muted: #94a3b8;
  --accent: #22d3ee;
  --accent-strong: #0891b2;
  --danger: #f87171;
  --success: #34d399;
  --shadow-elevated: 0 22px 48px rgba(2, 6, 23, 0.45);
}

:global(body) {
  margin: 0;
  background: var(--bg-app);
  color: var(--text-primary);
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.camera-app {
  min-height: 100vh;
  padding: clamp(1.5rem, 4vw, 3rem);
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.camera-app__header {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

@media (min-width: 960px) {
  .camera-app__header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}

.camera-app__header h1 {
  margin: 0 0 0.5rem;
  font-size: clamp(2.1rem, 4vw, 2.8rem);
  font-weight: 700;
}

.camera-app__header p {
  margin: 0;
  max-width: 48rem;
  line-height: 1.6;
  color: var(--text-muted);
}

.camera-app__header-status {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: flex-start;
}

@media (min-width: 480px) {
  .camera-app__header-status {
    align-items: flex-end;
  }
}

.camera-app__model {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: rgba(34, 211, 238, 0.12);
  color: #a5f3fc;
}

button.ghost {
  appearance: none;
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--text-primary);
  border-radius: 999px;
  padding: 0.4rem 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

button.ghost:disabled {
  opacity: 0.6;
  cursor: progress;
}

button.ghost:not(:disabled):hover {
  border-color: var(--accent);
  background: rgba(34, 211, 238, 0.12);
}

.camera-app__alert {
  margin: 0;
  padding: 0.9rem 1.2rem;
  border-radius: 0.85rem;
  background: rgba(248, 113, 113, 0.12);
  color: #fecaca;
  border: 1px solid rgba(248, 113, 113, 0.35);
}

.camera-app__content {
  display: grid;
  gap: 1.75rem;
}

@media (min-width: 1120px) {
  .camera-app__content {
    grid-template-columns: minmax(0, 1.45fr) minmax(0, 0.75fr);
    align-items: start;
  }
}

.camera-feed {
  background: var(--surface);
  border-radius: 1.25rem;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-elevated);
  padding: clamp(1.25rem, 3vw, 1.75rem);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.camera-feed__viewport {
  position: relative;
  border-radius: 1rem;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: radial-gradient(circle at top, rgba(34, 211, 238, 0.22), rgba(15, 23, 42, 0.75));
}

.camera-feed__viewport iframe {
  width: 100%;
  min-height: clamp(240px, 36vw, 480px);
  border: 0;
  background: #000;
}

.camera-feed__footer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.camera-feed__label {
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.06em;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.camera-feed__url {
  padding: 0.25rem 0.6rem;
  background: rgba(15, 23, 42, 0.85);
  border-radius: 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.24);
  color: var(--text-primary);
}

.camera-feed__meta {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.camera-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.control-card,
.preset-card {
  background: var(--surface);
  border-radius: 1.25rem;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-elevated);
  padding: clamp(1.1rem, 2.5vw, 1.6rem);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.control-card__header,
.preset-card__header {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.control-card__header h2,
.preset-card__header h2 {
  margin: 0;
  font-size: 1.1rem;
}

.control-card__header p,
.preset-card__header p {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.5;
  font-size: 0.9rem;
}

.control-card__badge {
  align-self: flex-start;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  background: rgba(34, 211, 238, 0.16);
  color: #a5f3fc;
}

.joystick {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 0.75rem;
  justify-items: center;
  align-items: center;
}

.joystick__spacer {
  display: block;
  width: 2.5rem;
  height: 2.5rem;
}

.joystick__button {
  appearance: none;
  width: clamp(3rem, 9vw, 3.75rem);
  height: clamp(3rem, 9vw, 3.75rem);
  border-radius: 50%;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(15, 23, 42, 0.85);
  color: var(--text-primary);
  font-size: 1.25rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
  box-shadow: 0 12px 25px rgba(2, 6, 23, 0.35);
}

.joystick__button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.joystick__button:hover {
  border-color: var(--accent);
  background: rgba(34, 211, 238, 0.18);
}

.joystick__button.is-active {
  border-color: var(--accent-strong);
  background: rgba(34, 211, 238, 0.35);
  transform: translateY(-2px);
  color: #ecfeff;
}

.joystick__button--center {
  width: clamp(3.2rem, 9.5vw, 4rem);
  height: clamp(3.2rem, 9.5vw, 4rem);
  font-size: 1rem;
  font-weight: 800;
}

.control-card__error {
  margin: 0;
  font-size: 0.9rem;
  color: #fecaca;
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.35);
  border-radius: 0.75rem;
  padding: 0.65rem 0.85rem;
}

.preset-card__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
}

.preset-card__button {
  appearance: none;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 0.85rem;
  background: rgba(15, 23, 42, 0.75);
  color: var(--text-primary);
  font-weight: 600;
  padding: 0.85rem 1rem;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.preset-card__button:hover:not(:disabled) {
  border-color: var(--accent);
  background: rgba(34, 211, 238, 0.18);
  transform: translateY(-1px);
}

.preset-card__button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.preset-card__button.is-loading {
  position: relative;
}

.preset-card__button.is-loading::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(34, 211, 238, 0.25);
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.25;
  }
  50% {
    opacity: 0.6;
  }
}

.preset-card__feedback {
  margin: 0;
  font-size: 0.9rem;
  color: #bbf7d0;
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.35);
  border-radius: 0.75rem;
  padding: 0.65rem 0.85rem;
}

.preset-card__error {
  margin: 0;
  font-size: 0.9rem;
  color: #fecaca;
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.35);
  border-radius: 0.75rem;
  padding: 0.65rem 0.85rem;
}
</style>
