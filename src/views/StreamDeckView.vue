<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Draggable from 'vue-draggable'
import { useControlStore } from '../composables/useControlStore'
import { createId } from '../lib/id'
import type { ActionInputType } from '../types/actions'
import type { StreamDeckItem } from '../types/stream-deck'

const store = useControlStore()

const presets = computed(() => store.presets.value)
const actions = computed(() => store.configuredActions.value)
const deckItems = computed(() => store.deckItems.value)
const deckGrid = computed(() => store.deckGrid.value)
const deckEvents = computed(() => store.deckEvents.value)

const search = ref('')

const presetMap = computed(() => {
  const map = new Map<string, string>()
  for (const preset of presets.value) {
    map.set(preset.id, preset.name)
  }
  return map
})

const actionMap = computed(() => {
  const map = new Map<string, string>()
  for (const action of actions.value) {
    map.set(action.definition.id, action.profile.label)
  }
  return map
})

interface LibraryItem {
  id: string
  label: string
  sourceType: StreamDeckItem['sourceType']
  sourceId: string
  defaultInput: ActionInputType
}

const library = computed<LibraryItem[]>(() => {
  const term = search.value.trim().toLowerCase()
  const presetEntries: LibraryItem[] = presets.value.map((preset) => ({
    id: `preset:${preset.id}`,
    label: preset.name,
    sourceType: 'preset',
    sourceId: preset.id,
    defaultInput: 'button',
  }))
  const actionEntries: LibraryItem[] = actions.value.map((action) => ({
    id: `action:${action.definition.id}`,
    label: action.profile.label,
    sourceType: 'action',
    sourceId: action.definition.id,
    defaultInput: action.profile.defaultInput,
  }))
  const combined = [...presetEntries, ...actionEntries]
  if (!term) {
    return combined
  }
  return combined.filter((entry) => entry.label.toLowerCase().includes(term))
})

const selectedDeckItemId = ref<string | null>(null)

watch(
  deckItems,
  (items) => {
    if (!items.length) {
      selectedDeckItemId.value = null
      return
    }
    if (!selectedDeckItemId.value || !items.some((item) => item.instanceId === selectedDeckItemId.value)) {
      const first = items[0]
      if (first) {
        selectedDeckItemId.value = first.instanceId
      }
    }
  },
  { immediate: true },
)

const selectedDeckItem = computed(() => deckItems.value.find((item) => item.instanceId === selectedDeckItemId.value) ?? null)

function cloneLibraryItem(item: LibraryItem): StreamDeckItem {
  return {
    instanceId: createId('deck'),
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    inputType: item.defaultInput,
    customLabel: '',
  }
}

function handleDeckUpdate(next: unknown[]) {
  const typed = next as StreamDeckItem[]
  store.setDeckItems(typed)
}

function selectDeckItem(id: string) {
  selectedDeckItemId.value = id
}

function removeDeckItem(id: string) {
  store.removeDeckItem(id)
}

function updateDeckItemInput(input: ActionInputType) {
  if (!selectedDeckItem.value) return
  store.updateDeckItem(selectedDeckItem.value.instanceId, { inputType: input })
}

function updateDeckItemLabel(label: string) {
  if (!selectedDeckItem.value) return
  store.updateDeckItem(selectedDeckItem.value.instanceId, { customLabel: label })
}

function updateDeckItemColor(color: string) {
  if (!selectedDeckItem.value) return
  store.updateDeckItem(selectedDeckItem.value.instanceId, { accentColor: color })
}

function triggerDeckEvent(item: StreamDeckItem, value?: number) {
  store.pushDeckEvent({
    instanceId: item.instanceId,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    inputType: item.inputType,
    value,
    timestamp: new Date().toISOString(),
  })
}

const gridForm = reactive({
  rows: deckGrid.value.rows,
  columns: deckGrid.value.columns,
})

watch(deckGrid, (value) => {
  gridForm.rows = value.rows
  gridForm.columns = value.columns
})

function applyGridSettings() {
  const rows = Math.min(6, Math.max(1, Number(gridForm.rows)))
  const columns = Math.min(8, Math.max(1, Number(gridForm.columns)))
  store.updateDeckGrid({ rows, columns })
}

function getDeckItemLabel(item: StreamDeckItem) {
  if (item.customLabel?.trim()) {
    return item.customLabel
  }
  if (item.sourceType === 'preset') {
    return presetMap.value.get(item.sourceId) ?? 'Preset inconnu'
  }
  return actionMap.value.get(item.sourceId) ?? 'Action inconnue'
}
</script>

<template>
  <div class="deck-view">
    <section class="deck-view__library">
      <header>
        <h2>Bibliothèque</h2>
        <input v-model="search" type="search" placeholder="Rechercher un preset ou une action" />
      </header>
      <!-- @ts-ignore -->
      <Draggable
        class="deck-library"
        :list="library"
        item-key="id"
        :group="{ name: 'stream-deck', pull: 'clone', put: false }"
        :clone="cloneLibraryItem"
        @update:list="() => {}"
        v-slot="{ element }"
      >
        <div class="deck-library__item" :data-type="element.sourceType">
          <span class="deck-library__label">{{ element.label }}</span>
          <span class="deck-library__type">{{ element.sourceType === 'preset' ? 'Preset' : 'Action' }}</span>
        </div>
      </Draggable>
    </section>

    <section class="deck-view__canvas">
      <header class="deck-view__canvas-header">
        <div>
          <h2>Stream deck virtuel</h2>
          <p>Glissez les éléments de la bibliothèque pour constituer votre surface de contrôle.</p>
        </div>
        <form class="deck-view__grid" @submit.prevent="applyGridSettings">
          <label>
            <span>Lignes</span>
            <input v-model.number="gridForm.rows" type="number" min="1" max="6" />
          </label>
          <label>
            <span>Colonnes</span>
            <input v-model.number="gridForm.columns" type="number" min="1" max="8" />
          </label>
          <button type="submit">Mettre à jour</button>
        </form>
      </header>

      <!-- @ts-ignore -->
      <Draggable
        class="deck-grid"
        :style="{ gridTemplateColumns: `repeat(${deckGrid.columns}, minmax(120px, 1fr))` }"
        :list="deckItems"
        item-key="instanceId"
        :group="{ name: 'stream-deck', pull: true, put: true }"
        @update:list="handleDeckUpdate"
        v-slot="{ element }"
      >
        <article
          class="deck-slot"
          :class="{ 'deck-slot--selected': element.instanceId === selectedDeckItemId }"
          :style="{ borderColor: element.accentColor ?? 'rgba(148, 163, 184, 0.25)' }"
          @click="selectDeckItem(element.instanceId)"
        >
          <header>
            <h3>{{ getDeckItemLabel(element) }}</h3>
            <span class="deck-slot__type">{{ element.inputType === 'ramp' ? 'Rampe' : 'Bouton' }}</span>
          </header>
          <div class="deck-slot__body">
            <button
              v-if="element.inputType === 'button'"
              type="button"
              class="deck-slot__button"
              @click.stop="triggerDeckEvent(element)"
            >
              Déclencher
            </button>
            <label v-else class="deck-slot__slider">
              <input
                type="range"
                min="0"
                max="100"
                @input.stop="triggerDeckEvent(element, Number(($event.target as HTMLInputElement).value))"
              />
            </label>
          </div>
        </article>
      </Draggable>
    </section>

    <aside v-if="selectedDeckItem" class="deck-view__inspector">
      <header>
        <h3>Propriétés</h3>
        <button type="button" @click="removeDeckItem(selectedDeckItem.instanceId)">Retirer</button>
      </header>
      <div class="deck-view__inspector-grid">
        <label>
          <span>Libellé personnalisé</span>
          <input
            :value="selectedDeckItem.customLabel ?? ''"
            type="text"
            placeholder="Nom affiché sur le deck"
            @change="updateDeckItemLabel(($event.target as HTMLInputElement).value)"
          />
        </label>
        <label>
          <span>Type d'entrée</span>
          <select
            :value="selectedDeckItem.inputType"
            @change="updateDeckItemInput(($event.target as HTMLSelectElement).value as ActionInputType)"
          >
            <option value="button">Bouton</option>
            <option value="ramp">Rampe</option>
          </select>
        </label>
        <label>
          <span>Couleur</span>
          <input
            :value="selectedDeckItem.accentColor ?? '#64748b'"
            type="color"
            @input="updateDeckItemColor(($event.target as HTMLInputElement).value)"
          />
        </label>
        <p class="deck-view__inspector-source">
          Source :
          <strong>
            {{
              selectedDeckItem.sourceType === 'preset'
                ? presetMap.get(selectedDeckItem.sourceId) ?? 'Preset inconnu'
                : actionMap.get(selectedDeckItem.sourceId) ?? 'Action inconnue'
            }}
          </strong>
        </p>
      </div>
    </aside>

    <section class="deck-view__events">
      <header>
        <h3>Historique des interactions</h3>
      </header>
      <ul>
        <li v-for="event in [...deckEvents].reverse()" :key="event.timestamp + event.instanceId">
          <span class="deck-view__event-time">{{ new Date(event.timestamp).toLocaleTimeString() }}</span>
          <span class="deck-view__event-label">
            {{ event.inputType === 'ramp' ? 'Rampe' : 'Bouton' }} → {{ getDeckItemLabel(deckItems.find((item) => item.instanceId === event.instanceId) ?? { ...event, customLabel: '' }) }}
          </span>
          <span v-if="typeof event.value !== 'undefined'" class="deck-view__event-value">{{ event.value }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.deck-view {
  display: grid;
  grid-template-columns: minmax(240px, 280px) 1fr minmax(240px, 280px);
  grid-template-rows: auto 1fr auto;
  gap: 1.5rem;
  align-items: start;
  min-height: 0;
}

.deck-view__library,
.deck-view__canvas,
.deck-view__inspector,
.deck-view__events {
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 1.5rem;
  padding: 1.5rem;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(10px);
}

.deck-view__library header {
  display: grid;
  gap: 0.75rem;
}

.deck-view__library input[type='search'] {
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(17, 24, 39, 0.82);
  color: #e2e8f0;
  padding: 0.55rem 0.75rem;
}

.deck-library {
  margin-top: 1rem;
}

.deck-library__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.65rem 0.75rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(17, 24, 39, 0.85);
  font-size: 0.9rem;
}

.deck-library__type {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(148, 163, 184, 0.75);
}

.deck-view__canvas {
  grid-column: 2 / 3;
  grid-row: 1 / 3;
  display: grid;
  gap: 1.2rem;
}

.deck-view__canvas-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.deck-view__canvas-header h2 {
  margin: 0;
}

.deck-view__canvas-header p {
  margin: 0.35rem 0 0;
  color: rgba(148, 163, 184, 0.85);
}

.deck-view__grid {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.deck-view__grid label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.deck-view__grid input {
  width: 68px;
  border-radius: 0.7rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(17, 24, 39, 0.85);
  color: #e2e8f0;
  padding: 0.35rem 0.5rem;
}

.deck-view__grid button {
  border: none;
  border-radius: 0.9rem;
  padding: 0.55rem 1rem;
  background: linear-gradient(130deg, #4f46e5, #7c3aed);
  color: white;
  cursor: pointer;
  font-weight: 600;
}

.deck-grid {
  display: grid;
  gap: 1rem;
}

.deck-slot {
  position: relative;
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 1.25rem;
  border: 2px solid rgba(148, 163, 184, 0.25);
  background: rgba(15, 23, 42, 0.9);
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.deck-slot--selected {
  border-color: rgba(96, 165, 250, 0.85);
  box-shadow: 0 20px 45px rgba(59, 130, 246, 0.25);
}

.deck-slot header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.deck-slot h3 {
  margin: 0;
  font-size: 1rem;
}

.deck-slot__type {
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.18);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.deck-slot__body {
  display: grid;
  place-items: center;
}

.deck-slot__button {
  border: none;
  border-radius: 999px;
  padding: 0.65rem 1.35rem;
  background: rgba(59, 130, 246, 0.25);
  color: #bfdbfe;
  font-weight: 600;
  cursor: pointer;
}

.deck-slot__slider input[type='range'] {
  width: 100%;
}

.deck-view__inspector {
  display: grid;
  gap: 1rem;
}

.deck-view__inspector header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.deck-view__inspector header button {
  border: none;
  border-radius: 999px;
  padding: 0.45rem 1rem;
  background: rgba(248, 113, 113, 0.2);
  color: #fecaca;
  cursor: pointer;
}

.deck-view__inspector-grid {
  display: grid;
  gap: 0.85rem;
}

.deck-view__inspector-grid label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.85rem;
}

.deck-view__inspector-grid input[type='text'],
.deck-view__inspector-grid select,
.deck-view__inspector-grid input[type='color'] {
  border-radius: 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(17, 24, 39, 0.8);
  color: #e2e8f0;
  padding: 0.5rem 0.7rem;
}

.deck-view__inspector-source {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(148, 163, 184, 0.8);
}

.deck-view__events {
  grid-column: 1 / -1;
  display: grid;
  gap: 0.75rem;
}

.deck-view__events ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
  max-height: 220px;
  overflow-y: auto;
}

.deck-view__events li {
  display: grid;
  grid-template-columns: 110px 1fr auto;
  gap: 0.75rem;
  background: rgba(15, 23, 42, 0.85);
  border-radius: 0.9rem;
  padding: 0.6rem 0.8rem;
  border: 1px solid rgba(148, 163, 184, 0.15);
}

.deck-view__event-time {
  font-size: 0.8rem;
  color: rgba(148, 163, 184, 0.75);
}

.deck-view__event-value {
  font-weight: 600;
  color: #bae6fd;
}

@media (max-width: 1280px) {
  .deck-view {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
  }

  .deck-view__canvas {
    grid-column: 1;
    grid-row: auto;
  }

  .deck-view__inspector {
    grid-column: 1;
  }
}
</style>
