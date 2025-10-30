<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ReorderableGrid from './draggable/ReorderableGrid.vue'
import type { ControlDefinition, ControlWidgetInstance } from '../shared/control.js'
import { useControlLayouts } from '../composables/useControlLayouts'
import { executeControlAction } from '../lib/api/controlActions'

const props = defineProps<{
  cameraId: string | null
  cameraName: string | null
}>()

const currentCameraId = computed(() => props.cameraId)
const {
  definitions,
  layout,
  isLoading,
  isSaving,
  error,
  addControl,
  removeControl,
  reorder,
  refresh,
} = useControlLayouts({ cameraId: currentCameraId })

interface ActiveCard {
  id: string
  widget: ControlWidgetInstance
  definition: ControlDefinition | null
}

const cards = ref<ActiveCard[]>([])
const feedback = ref<string | null>(null)
const feedbackType = ref<'success' | 'error'>('success')
let feedbackTimer: number | null = null
let isSyncingFromLayout = false

const definitionMap = computed(() => {
  const map = new Map<string, ControlDefinition>()
  for (const definition of definitions.value) {
    map.set(definition.id, definition)
  }
  return map
})

const activeCards = computed(() =>
  cards.value.filter(
    (card): card is ActiveCard & { definition: ControlDefinition } =>
      card.definition !== null,
  ),
)

const plannedControls = computed(() =>
  definitions.value.filter((definition) => definition.availability === 'planned'),
)

const availableGroups = computed(() => {
  const groups = new Map<string, ControlDefinition[]>()
  for (const definition of definitions.value) {
    if (definition.availability !== 'available') {
      continue
    }

    const group = groups.get(definition.category)
    if (!group) {
      groups.set(definition.category, [definition])
    } else {
      group.push(definition)
    }
  }

  return Array.from(groups.entries()).map(([category, items]) => ({
    category,
    items,
  }))
})

watch(
  [layout, definitions],
  () => {
    isSyncingFromLayout = true
    if (!layout.value) {
      cards.value = []
    } else {
      cards.value = layout.value.widgets.map((widget) => ({
        id: widget.id,
        widget,
        definition: definitionMap.value.get(widget.controlId) ?? null,
      }))
    }
    Promise.resolve().then(() => {
      isSyncingFromLayout = false
    })
  },
  { immediate: true },
)

async function handleExecute(definition: ControlDefinition) {
  try {
    const message = await executeControlAction(definition.action)
    feedbackType.value = 'success'
    feedback.value = message
  } catch (err: any) {
    feedbackType.value = 'error'
    feedback.value = err?.message ?? 'Commande impossible à exécuter'
  }

  if (feedbackTimer) {
    clearTimeout(feedbackTimer)
  }

  feedbackTimer = window.setTimeout(() => {
    feedback.value = null
    feedbackTimer = null
  }, 4000)
}

async function handleAdd(controlId: string) {
  await addControl(controlId)
}

async function handleRemove(widgetId: string) {
  await removeControl(widgetId)
}

async function handleDragEnd(nextCards?: unknown) {
  if (!layout.value || isSyncingFromLayout) {
    return
  }

  const source = Array.isArray(nextCards) ? (nextCards as ActiveCard[]) : cards.value
  const nextOrder = source.map((card) => card.id)
  const currentOrder = layout.value.widgets.map((widget) => widget.id)
  const hasChanged =
    nextOrder.length !== currentOrder.length ||
    nextOrder.some((widgetId, index) => widgetId !== currentOrder[index])

  if (!hasChanged) {
    return
  }

  await reorder(nextOrder)
}

onBeforeUnmount(() => {
  if (feedbackTimer) {
    clearTimeout(feedbackTimer)
  }
})
</script>

<template>
  <section class="control-container">
    <header class="control-container__header">
      <div>
        <h2>Contrôles de caméra</h2>
        <p v-if="cameraName">{{ cameraName }}</p>
        <p v-else class="control-container__hint">Sélectionnez une caméra pour personnaliser le panneau.</p>
      </div>
      <div class="control-container__status">
        <button type="button" class="ghost" @click="refresh" :disabled="isLoading || !cameraId">
          Actualiser
        </button>
        <span v-if="isSaving" class="control-container__badge">Sauvegarde…</span>
        <span v-else-if="error" class="control-container__badge control-container__badge--error">{{ error }}</span>
        <span v-else-if="feedback" :class="['control-container__badge', feedbackType === 'error' ? 'control-container__badge--error' : 'control-container__badge--success']">
          {{ feedback }}
        </span>
      </div>
    </header>

    <div v-if="isLoading" class="control-container__loader">Chargement de la configuration…</div>
    <div v-else-if="!cameraId" class="control-container__empty">Choisissez une caméra pour activer les contrôles.</div>
    <div v-else class="control-container__body">
      <div class="control-grid-wrapper">
        <p v-if="activeCards.length === 0" class="control-grid__empty">
          Aucun contrôle configuré. Ajoutez des actions depuis la bibliothèque pour commencer.
        </p>
        <ReorderableGrid
          v-model="cards"
          item-key="id"
          handle-selector=".control-card__drag-handle"
          class="control-grid"
          @end="handleDragEnd"
        >
          <template #item="{ element }">
            <article class="control-card" :data-widget-id="element.id">
              <div class="control-card__drag-handle" title="Glisser pour réorganiser">⠿</div>
              <div class="control-card__content">
                <header>
                  <h3>{{ element.definition?.label ?? 'Contrôle inconnu' }}</h3>
                  <small v-if="element.definition">{{ element.definition.category }}</small>
                </header>
                <p>
                  {{
                    element.definition?.description ??
                      'Ce contrôle ne fait plus partie du catalogue disponible.'
                  }}
                </p>
              </div>
              <footer class="control-card__actions">
                <button
                  type="button"
                  class="primary"
                  @click="element.definition && handleExecute(element.definition)"
                  :disabled="!element.definition || element.definition.availability !== 'available'"
                >
                  Exécuter
                </button>
                <button type="button" class="ghost" @click="handleRemove(element.widget.id)">Retirer</button>
              </footer>
            </article>
          </template>
        </ReorderableGrid>
      </div>

      <aside class="control-library">
        <h3>Bibliothèque de contrôles</h3>
        <p>Glissez-déposez ou ajoutez des raccourcis issus de l’ancien contrôleur.</p>
        <div v-for="group in availableGroups" :key="group.category" class="control-library__group">
          <h4>{{ group.category }}</h4>
          <ul>
            <li v-for="control in group.items" :key="control.id">
              <div>
                <strong>{{ control.label }}</strong>
                <span>{{ control.description }}</span>
              </div>
              <button type="button" class="primary" @click="handleAdd(control.id)">Ajouter</button>
            </li>
          </ul>
        </div>

        <div v-if="plannedControls.length" class="control-library__planned">
          <h4>En préparation</h4>
          <ul>
            <li v-for="control in plannedControls" :key="control.id">
              <div>
                <strong>{{ control.label }}</strong>
                <span>{{ control.description }}</span>
              </div>
              <span class="planned">À venir</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.control-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.control-container__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.control-container__header h2 {
  margin: 0;
}

.control-container__header p {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
}

.control-container__hint {
  font-size: 0.9rem;
}

.control-container__status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.control-container__badge {
  font-size: 0.75rem;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: var(--surface-muted);
}

.control-container__badge--error {
  background: rgba(248, 113, 113, 0.2);
  color: #fecaca;
}

.control-container__badge--success {
  background: rgba(34, 197, 94, 0.2);
  color: #bbf7d0;
}

.control-container__loader,
.control-container__empty {
  padding: 2rem;
  border: 1px dashed var(--border);
  border-radius: 1rem;
  text-align: center;
  color: var(--text-muted);
}

.control-container__body {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
  gap: 1.5rem;
}

.control-grid-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.control-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}

.control-grid__empty {
  margin: 0;
  padding: 1.5rem;
  text-align: center;
  border: 1px dashed var(--border);
  border-radius: 0.75rem;
  color: var(--text-muted);
}

.control-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  position: relative;
}

.control-card__drag-handle {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  cursor: grab;
  font-size: 1rem;
  color: var(--text-muted);
}

.control-card__content header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
}

.control-card__content h3 {
  margin: 0;
  font-size: 1rem;
}

.control-card__content small {
  color: var(--text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.control-card__content p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.control-card__actions {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.control-card__actions .primary,
.control-library button.primary {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.control-card__actions .primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.control-card__actions .ghost,
.control-container__status .ghost,
.control-library button.ghost {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: 0.5rem;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
}

.control-library {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.control-library__group ul,
.control-library__planned ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}

.control-library__group li,
.control-library__planned li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.control-library__group li span,
.control-library__planned li span {
  display: block;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.control-library__planned .planned {
  font-size: 0.75rem;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.2);
  color: var(--text-muted);
}

@media (max-width: 1024px) {
  .control-container__body {
    grid-template-columns: 1fr;
  }
}
</style>
