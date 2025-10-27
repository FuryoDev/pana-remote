<script setup lang="ts">
import type { PanTiltDirection, PanTiltMoveDirection } from '../types/ptz'

const props = defineProps<{
  disabled?: boolean
  activeDirection: PanTiltDirection
}>()

const emit = defineEmits<{
  (e: 'move', direction: PanTiltMoveDirection): void
  (e: 'stop'): void
}>()

const moveButtons: Array<{ direction: PanTiltMoveDirection; label: string; icon: string; class: string }> = [
  { direction: 'up', label: 'Monter', icon: '▲', class: 'pad__button--up' },
  { direction: 'left', label: 'Aller à gauche', icon: '◀', class: 'pad__button--left' },
  { direction: 'right', label: 'Aller à droite', icon: '▶', class: 'pad__button--right' },
  { direction: 'down', label: 'Descendre', icon: '▼', class: 'pad__button--down' },
]

function handlePointerDown(direction: PanTiltMoveDirection, event: PointerEvent | MouseEvent | TouchEvent) {
  if (props.disabled) {
    return
  }

  if (event instanceof PointerEvent) {
    ;(event.target as HTMLElement | null)?.setPointerCapture?.(event.pointerId)
  }

  emit('move', direction)
}

function handlePointerUp(event: PointerEvent | MouseEvent | TouchEvent) {
  if (props.disabled) {
    return
  }

  if (event instanceof PointerEvent) {
    const target = event.target as HTMLElement | null
    target?.releasePointerCapture?.(event.pointerId)
  }

  emit('stop')
}

function isActive(direction: PanTiltDirection) {
  return props.activeDirection === direction
}
</script>

<template>
  <div class="controller">
    <div class="pad" role="group" aria-label="Contrôle panoramique/inclinaison">
      <button
        v-for="button in moveButtons"
        :key="button.direction"
        type="button"
        class="pad__button"
        :class="[button.class, { 'is-active': isActive(button.direction) }]"
        :aria-label="button.label"
        @pointerdown.prevent="handlePointerDown(button.direction, $event)"
        @pointerup.prevent="handlePointerUp($event)"
        @pointerleave.prevent="handlePointerUp($event)"
        @pointercancel.prevent="handlePointerUp($event)"
        :disabled="disabled"
      >
        <span aria-hidden="true">{{ button.icon }}</span>
      </button>

      <button
        type="button"
        class="pad__button pad__button--center"
        :class="{ 'is-active': isActive('stop') }"
        aria-label="Arrêter le mouvement"
        @click.prevent="emit('stop')"
        :disabled="disabled"
      >
        <span aria-hidden="true">●</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.controller {
  display: flex;
  justify-content: center;
  align-items: center;
}

.pad {
  display: grid;
  grid-template-columns: repeat(3, 4rem);
  grid-template-rows: repeat(3, 4rem);
  gap: 0.5rem;
  position: relative;
}

.pad__button {
  appearance: none;
  border: none;
  border-radius: 1rem;
  background: rgba(15, 23, 42, 0.2);
  color: #f8fafc;
  font-size: 1.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.25);
}

.pad__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pad__button:not(:disabled):active,
.pad__button.is-active {
  transform: translateY(1px);
  background: rgba(37, 99, 235, 0.85);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
}

.pad__button span {
  pointer-events: none;
}

.pad__button--up {
  grid-column: 2;
  grid-row: 1;
}

.pad__button--left {
  grid-column: 1;
  grid-row: 2;
}

.pad__button--right {
  grid-column: 3;
  grid-row: 2;
}

.pad__button--down {
  grid-column: 2;
  grid-row: 3;
}

.pad__button--center {
  grid-column: 2;
  grid-row: 2;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.35);
  font-size: 1.1rem;
}

.pad__button--center:not(:disabled):hover {
  background: rgba(30, 41, 59, 0.65);
}
</style>
