<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Draggable from 'vue-draggable'
import { useControlStore } from '../composables/useControlStore'
import type { ActionInputType } from '../types/actions'
import type { Preset } from '../types/presets'

const store = useControlStore()

const presets = computed(() => store.presets.value)
const actions = computed(() => store.configuredActions.value)

const creationForm = reactive({
  name: '',
  description: '',
  color: '#6366f1',
})

const selectedPresetId = ref<string | null>(presets.value[0]?.id ?? null)

watch(
  presets,
  (next) => {
    if (!next.length) {
      selectedPresetId.value = null
      return
    }
    if (!selectedPresetId.value || !next.some((preset) => preset.id === selectedPresetId.value)) {
      const first = next[0]
      if (first) {
        selectedPresetId.value = first.id
      }
    }
  },
  { immediate: true },
)

const selectedPreset = computed(() => presets.value.find((preset) => preset.id === selectedPresetId.value) ?? null)

const actionSearch = ref('')
const actionFilter = computed(() => actionSearch.value.trim().toLowerCase())

const filteredActions = computed(() => {
  const term = actionFilter.value
  if (!term) {
    return actions.value
  }
  return actions.value.filter((action) => {
    const haystack = `${action.profile.label} ${action.definition.name} ${action.definition.filePath}`.toLowerCase()
    return haystack.includes(term)
  })
})

function handleCreatePreset() {
  if (!creationForm.name.trim()) {
    return
  }
  const preset = store.createPreset({
    name: creationForm.name,
    description: creationForm.description,
    color: creationForm.color,
  })
  creationForm.name = ''
  creationForm.description = ''
  selectedPresetId.value = preset.id
}

function handlePresetReorder(next: unknown[]) {
  const typed = next as Preset[]
  store.reorderPresets(typed)
}

function selectPreset(id: string) {
  selectedPresetId.value = id
}

function updatePreset(updates: Partial<Omit<Preset, 'id'>>) {
  if (!selectedPreset.value) return
  store.updatePreset(selectedPreset.value.id, updates)
}

function deleteSelectedPreset() {
  if (!selectedPreset.value) {
    return
  }
  store.removePreset(selectedPreset.value.id)
}

function isActionSelected(actionId: string) {
  return selectedPreset.value?.actions.some((binding) => binding.actionId === actionId)
}

function toggleAction(actionId: string) {
  if (!selectedPreset.value) {
    return
  }

  const bindings = [...selectedPreset.value.actions]
  const index = bindings.findIndex((binding) => binding.actionId === actionId)
  if (index >= 0) {
    bindings.splice(index, 1)
  } else {
    const configured = actions.value.find((action) => action.definition.id === actionId)
    const defaultInput = configured?.profile.defaultInput ?? 'button'
    bindings.push({ actionId, inputType: defaultInput })
  }
  store.updatePresetActions(selectedPreset.value.id, bindings)
}

function updateBindingInput(actionId: string, input: ActionInputType) {
  if (!selectedPreset.value) {
    return
  }
  const bindings = selectedPreset.value.actions.map((binding) =>
    binding.actionId === actionId ? { ...binding, inputType: input } : binding,
  )
  store.updatePresetActions(selectedPreset.value.id, bindings)
}

function updateBindingNotes(actionId: string, notes: string) {
  if (!selectedPreset.value) {
    return
  }
  const bindings = selectedPreset.value.actions.map((binding) =>
    binding.actionId === actionId ? { ...binding, notes } : binding,
  )
  store.updatePresetActions(selectedPreset.value.id, bindings)
}
</script>

<template>
  <div class="preset-manager">
    <section class="preset-manager__sidebar">
      <header>
        <h2>Presets</h2>
        <p>Créez, organisez et sélectionnez un preset pour modifier ses actions.</p>
      </header>

      <form class="preset-manager__creation" @submit.prevent="handleCreatePreset">
        <label>
          <span>Nom du preset</span>
          <input v-model="creationForm.name" type="text" required placeholder="Preset studio" />
        </label>
        <label>
          <span>Description</span>
          <textarea v-model="creationForm.description" rows="2" placeholder="Décrit l'objectif du preset"></textarea>
        </label>
        <label class="preset-manager__color">
          <span>Couleur</span>
          <input v-model="creationForm.color" type="color" />
        </label>
        <button type="submit" class="preset-manager__create">Ajouter</button>
      </form>

      <!-- @ts-ignore -->
      <Draggable
        class="preset-manager__list"
        :list="presets"
        item-key="id"
        @update:list="handlePresetReorder"
        v-slot="{ element }"
      >
        <button
          type="button"
          class="preset-manager__item"
          :class="{ 'preset-manager__item--active': element.id === selectedPresetId }"
          @click="selectPreset(element.id)"
        >
          <span class="preset-manager__item-accent" :style="{ background: element.color || '#475569' }" />
          <span class="preset-manager__item-name">{{ element.name }}</span>
          <span class="preset-manager__item-count">{{ element.actions.length }} action(s)</span>
        </button>
      </Draggable>
    </section>

    <section v-if="selectedPreset" key="editor" class="preset-manager__editor">
      <header class="preset-manager__editor-header">
        <div>
          <h2>{{ selectedPreset.name }}</h2>
          <p>Assignez des actions, configurez les notes et le type d'entrée attendu.</p>
        </div>
        <button type="button" class="preset-manager__delete" @click="deleteSelectedPreset">Supprimer</button>
      </header>

      <div class="preset-manager__details">
        <label>
          <span>Nom</span>
          <input v-model="selectedPreset.name" type="text" @blur="updatePreset({ name: selectedPreset.name })" />
        </label>
        <label>
          <span>Description</span>
          <textarea
            v-model="selectedPreset.description"
            rows="3"
            @blur="updatePreset({ description: selectedPreset.description })"
          ></textarea>
        </label>
        <label>
          <span>Couleur</span>
          <input
            v-model="selectedPreset.color"
            type="color"
            @change="updatePreset({ color: selectedPreset.color })"
          />
        </label>
      </div>

      <div class="preset-manager__editor-body">
        <section class="preset-manager__bindings">
          <header>
            <h3>Actions associées</h3>
            <p>Sélectionnez une action pour modifier son type ou ajouter des notes.</p>
          </header>
          <ul v-if="selectedPreset.actions.length" class="preset-manager__binding-list">
            <li v-for="binding in selectedPreset.actions" :key="binding.actionId" class="preset-manager__binding">
              <div class="preset-manager__binding-header">
                <strong>{{ actions.find((action) => action.definition.id === binding.actionId)?.profile.label }}</strong>
                <button type="button" class="preset-manager__binding-remove" @click="toggleAction(binding.actionId)">
                  Retirer
                </button>
              </div>
              <div class="preset-manager__binding-grid">
                <label>
                  <span>Type d'entrée</span>
                  <select :value="binding.inputType" @change="updateBindingInput(binding.actionId, ($event.target as HTMLSelectElement).value as ActionInputType)">
                    <option value="button">Bouton</option>
                    <option value="ramp">Rampe</option>
                  </select>
                </label>
                <label>
                  <span>Notes</span>
                  <textarea
                    :value="binding.notes ?? ''"
                    rows="2"
                    placeholder="Paramètres personnalisés"
                    @change="updateBindingNotes(binding.actionId, ($event.target as HTMLTextAreaElement).value)"
                  ></textarea>
                </label>
              </div>
            </li>
          </ul>
          <p v-else class="preset-manager__empty">Aucune action associée pour le moment.</p>
        </section>

        <section class="preset-manager__catalog">
          <header>
            <h3>Bibliothèque d'actions</h3>
            <input v-model="actionSearch" type="search" placeholder="Rechercher une action ou un fichier" />
          </header>
          <ul class="preset-manager__action-list">
            <li v-for="action in filteredActions" :key="action.definition.id">
              <label class="preset-manager__action">
                <input
                  type="checkbox"
                  :checked="isActionSelected(action.definition.id)"
                  @change="toggleAction(action.definition.id)"
                />
                <div>
                  <span class="preset-manager__action-label">{{ action.profile.label }}</span>
                  <small>{{ action.definition.filePath }}</small>
                </div>
                <span class="preset-manager__action-tag">{{ action.profile.defaultInput === 'ramp' ? 'Rampe' : 'Bouton' }}</span>
              </label>
            </li>
          </ul>
        </section>
      </div>
    </section>

    <section v-else class="preset-manager__empty-state">
      <h2>Aucun preset sélectionné</h2>
      <p>Commencez par créer un preset dans la colonne de gauche.</p>
    </section>
  </div>
</template>

<style scoped>
.preset-manager {
  display: grid;
  grid-template-columns: minmax(260px, 320px) 1fr;
  gap: 1.5rem;
  min-height: 0;
}

.preset-manager__sidebar,
.preset-manager__editor,
.preset-manager__empty-state {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 1.5rem;
  padding: 1.5rem;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(10px);
}

.preset-manager__sidebar header h2 {
  margin: 0;
}

.preset-manager__sidebar header p {
  margin: 0.35rem 0 1.2rem;
  color: rgba(148, 163, 184, 0.9);
  font-size: 0.9rem;
}

.preset-manager__creation {
  display: grid;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.preset-manager__creation label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.85rem;
}

.preset-manager__creation input[type='text'],
.preset-manager__creation textarea {
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(17, 24, 39, 0.78);
  color: #e2e8f0;
  padding: 0.55rem 0.75rem;
  resize: vertical;
}

.preset-manager__creation textarea {
  min-height: 62px;
}

.preset-manager__color {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preset-manager__color input[type='color'] {
  width: 100%;
  height: 38px;
  border: none;
  border-radius: 0.9rem;
  padding: 0;
  background: transparent;
}

.preset-manager__create {
  border: none;
  border-radius: 0.9rem;
  padding: 0.6rem 0.85rem;
  background: linear-gradient(120deg, #6366f1, #8b5cf6);
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.preset-manager__create:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 40px rgba(99, 102, 241, 0.35);
}

.preset-manager__list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.preset-manager__item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
  padding: 0.65rem 0.8rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(17, 24, 39, 0.78);
  color: inherit;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.preset-manager__item:hover {
  transform: translateX(2px);
  border-color: rgba(99, 102, 241, 0.5);
}

.preset-manager__item--active {
  border-color: rgba(129, 140, 248, 0.85);
  background: rgba(79, 70, 229, 0.28);
}

.preset-manager__item-accent {
  width: 12px;
  height: 12px;
  border-radius: 999px;
}

.preset-manager__item-name {
  text-align: left;
  font-weight: 600;
}

.preset-manager__item-count {
  font-size: 0.75rem;
  color: rgba(148, 163, 184, 0.85);
}

.preset-manager__editor {
  display: grid;
  gap: 1.5rem;
  min-width: 0;
}

.preset-manager__editor-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.preset-manager__editor-header h2 {
  margin: 0;
}

.preset-manager__editor-header p {
  margin: 0.35rem 0 0;
  color: rgba(148, 163, 184, 0.85);
}

.preset-manager__delete {
  border: none;
  border-radius: 999px;
  padding: 0.45rem 1.2rem;
  background: rgba(248, 113, 113, 0.12);
  color: #fca5a5;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.preset-manager__delete:hover {
  background: rgba(248, 113, 113, 0.25);
}

.preset-manager__details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.preset-manager__details label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.85rem;
}

.preset-manager__details input[type='text'],
.preset-manager__details textarea,
.preset-manager__details input[type='color'] {
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(17, 24, 39, 0.78);
  color: #e2e8f0;
  padding: 0.55rem 0.75rem;
}

.preset-manager__details input[type='color'] {
  padding: 0;
  height: 40px;
}

.preset-manager__editor-body {
  display: grid;
  grid-template-columns: minmax(280px, 320px) 1fr;
  gap: 1.5rem;
  align-items: start;
  min-height: 0;
}

.preset-manager__bindings,
.preset-manager__catalog {
  display: grid;
  gap: 1rem;
  background: rgba(10, 17, 30, 0.85);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 1.25rem;
  padding: 1.1rem;
}

.preset-manager__bindings header h3,
.preset-manager__catalog header h3 {
  margin: 0;
}

.preset-manager__bindings header p {
  margin: 0.4rem 0 0;
  color: rgba(148, 163, 184, 0.8);
  font-size: 0.8rem;
}

.preset-manager__binding-list {
  display: grid;
  gap: 1rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.preset-manager__binding {
  display: grid;
  gap: 0.65rem;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(99, 102, 241, 0.18);
  border-radius: 1rem;
  padding: 0.85rem;
}

.preset-manager__binding-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.preset-manager__binding-header strong {
  font-size: 0.95rem;
}

.preset-manager__binding-remove {
  border: none;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: rgba(248, 113, 113, 0.2);
  color: #fecaca;
  cursor: pointer;
}

.preset-manager__binding-grid {
  display: grid;
  gap: 0.75rem;
}

.preset-manager__binding-grid label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.8rem;
}

.preset-manager__binding-grid select,
.preset-manager__binding-grid textarea {
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(17, 24, 39, 0.82);
  color: #e2e8f0;
  padding: 0.5rem 0.75rem;
}

.preset-manager__empty {
  margin: 0;
  color: rgba(148, 163, 184, 0.75);
  font-size: 0.9rem;
}

.preset-manager__catalog header {
  display: grid;
  gap: 0.65rem;
}

.preset-manager__catalog input[type='search'] {
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(17, 24, 39, 0.78);
  color: #e2e8f0;
  padding: 0.55rem 0.75rem;
}

.preset-manager__action-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.6rem;
  max-height: 420px;
  overflow-y: auto;
}

.preset-manager__action {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.6rem 0.75rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.82);
  cursor: pointer;
}

.preset-manager__action input[type='checkbox'] {
  width: 1rem;
  height: 1rem;
}

.preset-manager__action-label {
  font-weight: 600;
}

.preset-manager__action small {
  display: block;
  margin-top: 0.2rem;
  color: rgba(148, 163, 184, 0.75);
  font-size: 0.75rem;
}

.preset-manager__action-tag {
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.18);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.preset-manager__empty-state {
  display: grid;
  place-content: center;
  text-align: center;
  gap: 0.75rem;
}

.preset-manager__empty-state h2 {
  margin: 0;
}

.preset-manager__empty-state p {
  margin: 0;
  color: rgba(148, 163, 184, 0.8);
}

@media (max-width: 1100px) {
  .preset-manager {
    grid-template-columns: 1fr;
  }

  .preset-manager__editor {
    order: 2;
  }

  .preset-manager__editor-body {
    grid-template-columns: 1fr;
  }
}
</style>
