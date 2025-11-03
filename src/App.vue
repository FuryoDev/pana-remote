<script setup lang="ts">
import { computed, ref } from 'vue'
import DashboardView from './views/DashboardView.vue'
import PresetManagerView from './views/PresetManagerView.vue'
import ActionConfigView from './views/ActionConfigView.vue'
import StreamDeckView from './views/StreamDeckView.vue'
import { useControlStore } from './composables/useControlStore'

type PageId = 'dashboard' | 'presets' | 'actions' | 'deck'

const pages: Array<{ id: PageId; label: string; description: string }> = [
  { id: 'dashboard', label: 'Tableau de bord', description: 'Statut caméra et prévisualisation' },
  { id: 'presets', label: 'Presets', description: 'Gérez les presets et assignez des actions' },
  { id: 'actions', label: 'Actions', description: 'Configurez les actions importées du projet legacy' },
  { id: 'deck', label: 'Stream Deck', description: 'Composez votre surface de contrôle virtuelle' },
]

const activePage = ref<PageId>('dashboard')

const { presets, deckItems } = useControlStore()

const summary = computed(() => ({
  presets: presets.value.length,
  deckSlots: deckItems.value.length,
}))

const currentComponent = computed(() => {
  switch (activePage.value) {
    case 'dashboard':
      return DashboardView
    case 'presets':
      return PresetManagerView
    case 'actions':
      return ActionConfigView
    case 'deck':
      return StreamDeckView
  }
})

function goTo(pageId: PageId) {
  activePage.value = pageId
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-header__titles">
        <h1>Pana Remote Control</h1>
        <p>Préparez vos configurations caméra, mappez les actions et organisez votre stream deck virtuel.</p>
      </div>
      <dl class="app-header__summary">
        <div>
          <dt>Presets</dt>
          <dd>{{ summary.presets }}</dd>
        </div>
        <div>
          <dt>Slots du deck</dt>
          <dd>{{ summary.deckSlots }}</dd>
        </div>
      </dl>
    </header>

    <nav class="app-nav" aria-label="Navigation principale">
      <ul>
        <li v-for="page in pages" :key="page.id">
          <button
            type="button"
            class="app-nav__link"
            :class="{ 'app-nav__link--active': page.id === activePage }"
            @click="goTo(page.id)"
          >
            <span class="app-nav__label">{{ page.label }}</span>
            <span class="app-nav__description">{{ page.description }}</span>
          </button>
        </li>
      </ul>
    </nav>

    <main class="app-content">
      <component :is="currentComponent" />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  background: radial-gradient(circle at top, rgba(79, 70, 229, 0.12), transparent 55%),
    linear-gradient(180deg, rgba(10, 10, 15, 0.95), rgba(10, 10, 15, 0.85));
}

.app-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1.5rem;
  padding: 1.75rem;
  background: rgba(17, 24, 39, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 1.5rem;
  box-shadow: 0 18px 60px rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(12px);
}

.app-header h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  color: #f8fafc;
}

.app-header p {
  margin: 0.4rem 0 0;
  max-width: 48ch;
  color: rgba(226, 232, 240, 0.72);
}

.app-header__summary {
  display: flex;
  gap: 1.75rem;
  margin: 0;
}

.app-header__summary div {
  display: grid;
  gap: 0.4rem;
  text-align: right;
}

.app-header__summary dt {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(148, 163, 184, 0.9);
}

.app-header__summary dd {
  margin: 0;
  font-size: 1.7rem;
  font-weight: 700;
  color: #f1f5f9;
}

.app-nav ul {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 0.75rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.app-nav__link {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  width: 100%;
  padding: 1rem 1.15rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.65);
  color: rgba(226, 232, 240, 0.78);
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;
}

.app-nav__link:hover {
  border-color: rgba(129, 140, 248, 0.55);
  transform: translateY(-2px);
}

.app-nav__link--active {
  border-color: rgba(99, 102, 241, 0.75);
  background: rgba(79, 70, 229, 0.22);
  color: #eef2ff;
  box-shadow: inset 0 1px 0 rgba(244, 244, 255, 0.15), 0 12px 30px rgba(76, 29, 149, 0.25);
}

.app-nav__label {
  font-weight: 600;
  font-size: 1.05rem;
}

.app-nav__description {
  font-size: 0.85rem;
  color: rgba(148, 163, 184, 0.85);
}

.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.app-content > * {
  flex: 1;
}

@media (max-width: 840px) {
  .app-header {
    padding: 1.25rem;
  }

  .app-header__summary {
    width: 100%;
    justify-content: flex-start;
  }

  .app-header__summary div {
    text-align: left;
  }
}
</style>
