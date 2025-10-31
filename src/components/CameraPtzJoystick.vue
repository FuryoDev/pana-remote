<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

type PtzDirection =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'up-left'
  | 'up-right'
  | 'down-left'
  | 'down-right'
  | 'stop'

const props = defineProps<{
  disabled?: boolean
  cameraName?: string | null
}>()

const activeDirection = ref<PtzDirection | null>(null)
const isInteracting = ref(false)
const isCommanding = ref(false)
const feedback = ref<string | null>(null)
const commandSpeed = 20

let commandChain: Promise<void> = Promise.resolve()

function enqueueCommand(direction: PtzDirection) {
  commandChain = commandChain
    .catch(() => {})
    .then(async () => {
      isCommanding.value = true
      feedback.value = null
      try {
        const response = await fetch('/api/ptz/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction, speed: commandSpeed }),
        })

        const raw = await response.text()
        if (!response.ok) {
          let message = `HTTP ${response.status}`
          try {
            const parsed = JSON.parse(raw)
            message = parsed?.error ?? message
          } catch {
            message = raw || message
          }
          throw new Error(message)
        }

        activeDirection.value = direction === 'stop' ? null : direction
      } catch (error: any) {
        feedback.value = error?.message ?? 'Commande PTZ refusée'
      } finally {
        isCommanding.value = false
      }
    })
}

function stopInteraction() {
  if (!isInteracting.value) {
    return
  }

  isInteracting.value = false
  removeGlobalListeners()
  enqueueCommand('stop')
}

function handlePointerDown(direction: PtzDirection) {
  if (props.disabled || isInteracting.value) {
    return
  }

  isInteracting.value = true
  addGlobalListeners()
  enqueueCommand(direction)
}

function handlePointerUp() {
  stopInteraction()
}

function handlePointerLeave(event: PointerEvent) {
  if (!isInteracting.value) {
    return
  }

  const target = event.currentTarget as HTMLElement | null
  if (target && event.pointerType === 'mouse') {
    // For mouse interactions we keep moving until the global pointerup is fired.
    return
  }

  stopInteraction()
}

function addGlobalListeners() {
  window.addEventListener('pointerup', stopInteraction)
  window.addEventListener('pointercancel', stopInteraction)
}

function removeGlobalListeners() {
  window.removeEventListener('pointerup', stopInteraction)
  window.removeEventListener('pointercancel', stopInteraction)
}

function handleCenterClick() {
  if (props.disabled) {
    return
  }

  if (isInteracting.value) {
    stopInteraction()
  } else {
    enqueueCommand('stop')
  }
}

onBeforeUnmount(() => {
  removeGlobalListeners()
})

const directions: Array<{
  id: PtzDirection
  icon: string
  label: string
}> = [
  { id: 'up', icon: '▲', label: 'Monter' },
  { id: 'down', icon: '▼', label: 'Descendre' },
  { id: 'left', icon: '◀', label: 'Gauche' },
  { id: 'right', icon: '▶', label: 'Droite' },
]

const isDisabled = () => Boolean(props.disabled)
</script>

<template>
  <section class="side-panel control-panel">
    <header>
      <h2>Contrôle directionnel</h2>
      <p class="control-panel__subtitle">
        {{
          isDisabled()
            ? 'Sélectionnez une caméra connectée pour piloter le mouvement.'
            : cameraName
              ? `Pilotage de ${cameraName}`
              : 'Pilotage de la caméra sélectionnée'
        }}
      </p>
    </header>

    <div class="joystick" :class="{ 'is-disabled': isDisabled() }">
      <button
        v-for="dir in directions"
        :key="dir.id"
        type="button"
        class="joystick__button"
        :data-direction="dir.id"
        :disabled="isDisabled()"
        :class="{
          'is-active': activeDirection === dir.id,
          'is-commanding': isCommanding,
        }"
        @pointerdown.prevent="handlePointerDown(dir.id)"
        @pointerup.prevent="handlePointerUp"
        @pointerleave="handlePointerLeave"
      >
        <span aria-hidden="true">{{ dir.icon }}</span>
        <span class="sr-only">{{ dir.label }}</span>
      </button>

      <button
        type="button"
        class="joystick__button joystick__button--center"
        :disabled="isDisabled() || isCommanding"
        :class="{ 'is-active': activeDirection === null && isInteracting }"
        @click.prevent="handleCenterClick"
      >
        <span aria-hidden="true">●</span>
        <span class="sr-only">Arrêter</span>
      </button>
    </div>

    <p v-if="feedback" class="control-panel__feedback">{{ feedback }}</p>
  </section>
</template>

<style scoped>
.control-panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.control-panel__subtitle {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
}

.joystick {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 0.75rem;
  padding: 1.25rem;
  border-radius: 1rem;
  background: var(--surface-muted);
  border: 1px solid var(--border-strong);
}

.joystick.is-disabled {
  opacity: 0.55;
}

.joystick__button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1 / 1;
  border-radius: 0.9rem;
  border: 1px solid var(--border-strong);
  background: var(--surface-raised);
  color: var(--text-primary);
  font-size: 1.2rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.2s ease, border-color 0.2s ease;
}

.joystick__button.is-active {
  background: var(--accent-soft);
  border-color: var(--accent);
  transform: translateY(-1px);
}

.joystick__button.is-commanding {
  pointer-events: none;
}

.joystick__button:disabled {
  cursor: not-allowed;
}

.joystick__button--center {
  grid-column: 2 / 3;
  grid-row: 2 / 3;
  font-size: 0.9rem;
}

.joystick__button[data-direction='up'] {
  grid-column: 2 / 3;
  grid-row: 1 / 2;
}

.joystick__button[data-direction='down'] {
  grid-column: 2 / 3;
  grid-row: 3 / 4;
}

.joystick__button[data-direction='left'] {
  grid-column: 1 / 2;
  grid-row: 2 / 3;
}

.joystick__button[data-direction='right'] {
  grid-column: 3 / 4;
  grid-row: 2 / 3;
}

.control-panel__feedback {
  margin: 0;
  font-size: 0.85rem;
  color: var(--danger);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
