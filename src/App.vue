<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type Component } from 'vue'
import ConnectionsView from './views/ConnectionsView.vue'
import ButtonsView from './views/ButtonsView.vue'
import PresetManagerView from './views/PresetManagerView.vue'
import ActionConfigView from './views/ActionConfigView.vue'
import { useControlStore } from './composables/useControlStore'

type PageId = 'connections' | 'buttons' | 'presets' | 'actions'

const pages: Array<{ id: PageId; label: string; description: string }> = [
  { id: 'connections', label: 'Connections', description: 'Configurer les caméras Canon PTZ' },
  { id: 'buttons', label: 'Buttons', description: 'Composer les pages du Stream Deck' },
  { id: 'presets', label: 'Presets', description: 'Gérer les presets stockés dans les caméras' },
  { id: 'actions', label: 'Actions', description: 'Adapter le catalogue d\'actions importées' },
]

const componentByPage: Record<PageId, Component> = {
  connections: ConnectionsView,
  buttons: ButtonsView,
  presets: PresetManagerView,
  actions: ActionConfigView,
}

const store = useControlStore()
const activePage = ref<PageId>('connections')
const isBrowser = typeof window !== 'undefined'

function syncFromHash() {
  if (!isBrowser) return
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (!hash) return
  const candidate = hash.split('/')[0] as PageId
  if (pages.some((page) => page.id === candidate)) {
    activePage.value = candidate
  }
}

function updateHash(pageId: PageId) {
  if (!isBrowser) return
  const next = `#/${pageId}`
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', next)
  }
}

function navigate(pageId: PageId) {
  activePage.value = pageId
  updateHash(pageId)
}

onMounted(() => {
  syncFromHash()
  if (isBrowser) {
    window.addEventListener('hashchange', syncFromHash)
  }
})

onBeforeUnmount(() => {
  if (isBrowser) {
    window.removeEventListener('hashchange', syncFromHash)
  }
})

const currentComponent = computed(() => componentByPage[activePage.value])

const summary = computed(() => {
  const connections = store.connections.value.length
  const presets = store.presets.value.length
  const pagesCount = store.deckPages.value.length
  const totalButtons = store.deckPages.value.reduce((total, page) => total + page.buttons.length, 0)
  return { connections, presets, pages: pagesCount, totalButtons }
})
</script>

<template>
  <div class="app-shell">
    <header class="app-shell__topbar">
      <div>
        <h1>Pana Remote Control</h1>
        <p>Contrôlez vos Canon PTZ avec Companion : configurez les connexions, organisez les boutons et optimisez vos presets.</p>
      </div>
      <dl class="app-shell__summary">
        <div>
          <dt>Connexions</dt>
          <dd>{{ summary.connections }}</dd>
        </div>
        <div>
          <dt>Pages Stream Deck</dt>
          <dd>{{ summary.pages }}</dd>
        </div>
        <div>
          <dt>Presets</dt>
          <dd>{{ summary.presets }}</dd>
        </div>
        <div>
          <dt>Boutons configurés</dt>
          <dd>{{ summary.totalButtons }}</dd>
        </div>
      </dl>
    </header>

    <nav class="app-shell__nav" aria-label="Navigation Companion">
      <ul>
        <li v-for="page in pages" :key="page.id">
          <button
            type="button"
            class="app-shell__nav-link"
            :class="{ 'app-shell__nav-link--active': page.id === activePage }"
            @click="navigate(page.id)"
          >
            <span class="app-shell__nav-label">{{ page.label }}</span>
            <span class="app-shell__nav-description">{{ page.description }}</span>
          </button>
        </li>
      </ul>
    </nav>

    <main class="app-shell__content">
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

.app-shell__topbar {
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

.app-shell__topbar h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  color: #f8fafc;
}

.app-shell__topbar p {
  margin: 0.4rem 0 0;
  max-width: 60ch;
  color: rgba(226, 232, 240, 0.72);
}

.app-shell__summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1.25rem;
  margin: 0;
}

.app-shell__summary div {
  display: grid;
  gap: 0.4rem;
  text-align: right;
}

.app-shell__summary dt {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(148, 163, 184, 0.9);
}

.app-shell__summary dd {
  margin: 0;
  font-size: 1.7rem;
  font-weight: 700;
  color: #f1f5f9;
}

.app-shell__nav ul {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.85rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.app-shell__nav-link {
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

.app-shell__nav-link:hover {
  border-color: rgba(129, 140, 248, 0.55);
  transform: translateY(-2px);
}

.app-shell__nav-link--active {
  border-color: rgba(239, 68, 68, 0.7);
  background: rgba(220, 38, 38, 0.22);
  color: #fee2e2;
  box-shadow: inset 0 1px 0 rgba(244, 244, 255, 0.15), 0 12px 30px rgba(185, 28, 28, 0.25);
}

.app-shell__nav-label {
  font-weight: 600;
  font-size: 1.05rem;
}

.app-shell__nav-description {
  font-size: 0.85rem;
  color: rgba(148, 163, 184, 0.85);
}

.app-shell__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

@media (max-width: 1024px) {
  .app-shell__summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
