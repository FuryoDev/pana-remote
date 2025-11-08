<script setup lang="ts">
import { computed, ref } from 'vue'
import { useControlStore } from '../composables/useControlStore'
import type { ActionInputType } from '../types/actions'

// Le store centralise la configuration et évite de multiplier les sources de vérité.
const store = useControlStore()

// On expose les actions pré-configurées afin de les annoter dans cette vue.
const actions = computed(() => store.configuredActions.value)
// Champs contrôlés par l'UI pour filtrer dynamiquement la liste.
const search = ref('')
const groupFilter = ref<'all' | string>('all')

const groups = computed(() => {
  // On construit la liste des dossiers à partir des actions chargées pour guider la navigation.
  const set = new Set(actions.value.map((action) => action.definition.group ?? 'autre'))
  return ['all', ...Array.from(set)]
})

const filteredActions = computed(() => {
  // Filtre textuel + par dossier pour aider l'opérateur à se concentrer sur une catégorie métier.
  const term = search.value.trim().toLowerCase()
  return actions.value.filter((action) => {
    if (groupFilter.value !== 'all' && action.definition.group !== groupFilter.value) {
      return false
    }
    if (!term) {
      return true
    }
    const haystack = `${action.profile.label} ${action.definition.name} ${action.definition.filePath}`.toLowerCase()
    return haystack.includes(term)
  })
})

function handleLabelChange(id: string, value: string) {
  store.updateActionProfile(id, { label: value })
}

function handleNotesChange(id: string, value: string) {
  store.updateActionProfile(id, { notes: value })
}

function handleTagsChange(id: string, value: string) {
  const tags = value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
  store.updateActionProfile(id, { tags })
}

function handleDefaultInput(id: string, value: ActionInputType) {
  store.updateActionProfile(id, { defaultInput: value })
}

function resetProfile(id: string) {
  store.resetActionProfile(id)
}
</script>

<template>
  <div class="action-config">
    <header class="action-config__header">
      <div>
        <h2>Configuration des actions</h2>
        <p>Personnalisez les libellés, notes et types d'entrée par défaut pour chaque action héritée.</p>
      </div>
      <div class="action-config__filters">
        <input v-model="search" type="search" placeholder="Rechercher une action" />
        <select v-model="groupFilter">
          <option v-for="group in groups" :key="group" :value="group">
            {{ group === 'all' ? 'Tous les dossiers' : group }}
          </option>
        </select>
      </div>
    </header>

    <section class="action-config__list">
      <!-- Chaque carte représente un profil d'action hérité qu'on peut contextualiser pour l'opérateur. -->
      <article v-for="action in filteredActions" :key="action.definition.id" class="action-card">
        <header class="action-card__header">
          <div>
            <h3>{{ action.profile.label }}</h3>
            <p>{{ action.definition.filePath }}</p>
          </div>
          <button type="button" class="action-card__reset" @click="resetProfile(action.definition.id)">
            Réinitialiser
          </button>
        </header>
        <div class="action-card__grid">
          <label>
            <span>Libellé affiché</span>
            <input
              :value="action.profile.label"
              type="text"
              @input="handleLabelChange(action.definition.id, ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label>
            <span>Type d'entrée par défaut</span>
            <select
              :value="action.profile.defaultInput"
              @change="handleDefaultInput(action.definition.id, ($event.target as HTMLSelectElement).value as ActionInputType)"
            >
              <option value="button">Bouton</option>
              <option value="ramp">Rampe</option>
            </select>
          </label>
          <label>
            <span>Tags</span>
            <input
              :value="action.profile.tags.join(', ')"
              type="text"
              placeholder="Ex: mouvement, zoom"
              @change="handleTagsChange(action.definition.id, ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="action-card__notes">
            <span>Notes</span>
            <textarea
              :value="action.profile.notes ?? ''"
              rows="3"
              placeholder="Informations complémentaires"
              @change="handleNotesChange(action.definition.id, ($event.target as HTMLTextAreaElement).value)"
            ></textarea>
          </label>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.action-config {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.action-config__header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 1.5rem;
  padding: 1.5rem;
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.35);
}

.action-config__header h2 {
  margin: 0;
}

.action-config__header p {
  margin: 0.4rem 0 0;
  color: rgba(148, 163, 184, 0.85);
  max-width: 48ch;
}

.action-config__filters {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.action-config__filters input,
.action-config__filters select {
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(17, 24, 39, 0.8);
  color: #e2e8f0;
  padding: 0.55rem 0.75rem;
}

.action-config__list {
  display: grid;
  gap: 1rem;
}

.action-card {
  background: rgba(10, 17, 30, 0.85);
  border: 1px solid rgba(99, 102, 241, 0.18);
  border-radius: 1.5rem;
  padding: 1.25rem;
  box-shadow: 0 18px 40px rgba(30, 41, 59, 0.35);
  display: grid;
  gap: 1rem;
}

.action-card__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.action-card__header h3 {
  margin: 0;
  font-size: 1.05rem;
}

.action-card__header p {
  margin: 0.3rem 0 0;
  color: rgba(148, 163, 184, 0.75);
  font-size: 0.85rem;
}

.action-card__reset {
  border: none;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  background: rgba(248, 113, 113, 0.18);
  color: #fecaca;
  cursor: pointer;
}

.action-card__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.action-card__grid label {
  display: grid;
  gap: 0.4rem;
  font-size: 0.85rem;
}

.action-card__grid input,
.action-card__grid select,
.action-card__grid textarea {
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(17, 24, 39, 0.82);
  color: #e2e8f0;
  padding: 0.55rem 0.75rem;
}

.action-card__notes {
  grid-column: 1 / -1;
}

@media (max-width: 860px) {
  .action-config__filters {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
