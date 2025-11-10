<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useControlStore } from '../composables/useControlStore'
import type { StreamDeckActionTargetType } from '../types/stream-deck'
import type { ActionInputType } from '../types/actions'

const store = useControlStore()

const pages = computed(() => [...store.deckPages.value].sort((a, b) => a.index - b.index))
const presets = computed(() => store.presets.value)
const actions = computed(() => store.configuredActions.value)

const activePageId = ref<string | null>(store.activeDeckPage.value?.id ?? null)

watch(
  () => store.activeDeckPageId.value,
  (value) => {
    if (value && value !== activePageId.value) {
      activePageId.value = value
    }
  },
  { immediate: true },
)

watch(activePageId, (value) => {
  if (value) {
    store.setActiveDeckPage(value)
  }
})

watch(
  pages,
  (next) => {
    if (!next.length) {
      activePageId.value = null
      return
    }
    if (!activePageId.value || !next.some((page) => page.id === activePageId.value)) {
      const first = next[0]
      if (first) {
        activePageId.value = first.id
      }
    }
  },
  { immediate: true },
)

const activePage = computed(() => {
  if (!pages.value.length) {
    return null
  }
  const id = activePageId.value
  if (!id) {
    return pages.value[0]
  }
  return pages.value.find((page) => page.id === id) ?? pages.value[0]
})

const pageForm = reactive({
  name: '',
})

watch(
  activePage,
  (page) => {
    pageForm.name = page?.name ?? ''
  },
  { immediate: true },
)

const selectedButtonId = ref<string | null>(null)

watch(
  activePage,
  (page) => {
    if (!page) {
      selectedButtonId.value = null
      return
    }
    if (!selectedButtonId.value || !page.buttons.some((button) => button.instanceId === selectedButtonId.value)) {
      selectedButtonId.value = page.buttons[0]?.instanceId ?? null
    }
  },
  { immediate: true },
)

const selectedButton = computed(() =>
  activePage.value?.buttons.find((button) => button.instanceId === selectedButtonId.value) ?? null,
)

const recentEvents = computed(() => {
  if (!activePage.value) {
    return []
  }
  return store.deckEvents.value
    .filter((event) => event.pageId === activePage.value?.id)
    .slice(-10)
    .reverse()
})

const actionOptions = computed(() =>
  actions.value.map((entry) => ({ id: entry.definition.id, label: entry.profile.label })).sort((a, b) =>
    a.label.localeCompare(b.label, 'fr'),
  ),
)

const presetOptions = computed(() =>
  presets.value.map((preset) => ({ id: preset.id, label: preset.name })).sort((a, b) =>
    a.label.localeCompare(b.label, 'fr'),
  ),
)

function goToPreviousPage() {
  if (!activePage.value) return
  const index = pages.value.findIndex((page) => page.id === activePage.value?.id)
  if (index > 0) {
    const previous = pages.value[index - 1]
    if (previous) {
      activePageId.value = previous.id
    }
  }
}

function goToNextPage() {
  if (!activePage.value) return
  const index = pages.value.findIndex((page) => page.id === activePage.value?.id)
  if (index >= 0 && index < pages.value.length - 1) {
    const next = pages.value[index + 1]
    if (next) {
      activePageId.value = next.id
    }
  }
}

function handleAddPage() {
  const created = store.addDeckPage()
  if (created) {
    activePageId.value = created.id
  }
}

function handleRemovePage() {
  if (!activePage.value) return
  store.removeDeckPage(activePage.value.id)
}

function savePageName() {
  if (!activePage.value) return
  if (!pageForm.name.trim()) {
    pageForm.name = activePage.value.name
    return
  }
  store.updateDeckPage(activePage.value.id, { name: pageForm.name })
}

function selectButton(buttonId: string) {
  selectedButtonId.value = buttonId
}

function setDisplayMode(mode: 'text' | 'icon') {
  if (!activePage.value || !selectedButton.value) return
  store.updateDeckButton(activePage.value.id, selectedButton.value.instanceId, {
    display: { mode },
  })
}

function updateDisplayText(value: string) {
  if (!activePage.value || !selectedButton.value) return
  store.updateDeckButton(activePage.value.id, selectedButton.value.instanceId, {
    display: { text: value },
  })
}

function clearDisplayText() {
  if (!activePage.value || !selectedButton.value) return
  store.updateDeckButton(activePage.value.id, selectedButton.value.instanceId, {
    display: { text: '' },
  })
}

function handleIconUpload(event: Event) {
  if (!activePage.value || !selectedButton.value) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.type !== 'image/png') {
    input.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      store.updateDeckButton(activePage.value!.id, selectedButton.value!.instanceId, {
        display: { iconDataUrl: reader.result, mode: 'icon' },
      })
    }
  }
  reader.readAsDataURL(file)
  input.value = ''
}

function clearIcon() {
  if (!activePage.value || !selectedButton.value) return
  store.updateDeckButton(activePage.value.id, selectedButton.value.instanceId, {
    display: { iconDataUrl: undefined, mode: 'text' },
  })
}

function updateBindingType(trigger: 'press' | 'release', type: StreamDeckActionTargetType) {
  if (!activePage.value || !selectedButton.value) return
  if (trigger === 'press') {
    store.updateDeckButton(activePage.value.id, selectedButton.value.instanceId, {
      pressBinding: {
        targetType: type,
        targetId: type === 'none' ? null : selectedButton.value.pressBinding.targetId,
      },
    })
  } else {
    store.updateDeckButton(activePage.value.id, selectedButton.value.instanceId, {
      releaseBinding: {
        targetType: type,
        targetId: type === 'none' ? null : selectedButton.value.releaseBinding.targetId,
      },
    })
  }
}

function updateBindingTarget(trigger: 'press' | 'release', targetId: string | null) {
  if (!activePage.value || !selectedButton.value) return
  if (trigger === 'press') {
    store.updateDeckButton(activePage.value.id, selectedButton.value.instanceId, {
      pressBinding: { targetId: targetId ?? null },
    })
  } else {
    store.updateDeckButton(activePage.value.id, selectedButton.value.instanceId, {
      releaseBinding: { targetId: targetId ?? null },
    })
  }
}

function updateInputType(value: ActionInputType) {
  if (!activePage.value || !selectedButton.value) return
  store.updateDeckButton(activePage.value.id, selectedButton.value.instanceId, {
    inputType: value,
  })
}

function updateAccentColor(value: string) {
  if (!activePage.value || !selectedButton.value) return
  store.updateDeckButton(activePage.value.id, selectedButton.value.instanceId, {
    accentColor: value.trim() ? value : undefined,
  })
}

function resetButton() {
  if (!activePage.value || !selectedButton.value) return
  const previousId = selectedButton.value.instanceId
  store.resetDeckButton(activePage.value.id, previousId)
  selectedButtonId.value = previousId
}

function logTest(trigger: 'press' | 'release') {
  if (!activePage.value || !selectedButton.value) return
  const binding = trigger === 'press' ? selectedButton.value.pressBinding : selectedButton.value.releaseBinding
  store.pushDeckEvent({
    buttonId: selectedButton.value.instanceId,
    pageId: activePage.value.id,
    trigger,
    targetType: binding.targetType,
    targetId: binding.targetId,
    timestamp: new Date().toISOString(),
  })
}
</script>

<template>
  <div class="buttons-view">
    <header class="buttons-view__header">
      <div>
        <h2>Surface de contrôle</h2>
        <p>Configurez les pages du Stream Deck, attribuez une action press et release, et personnalisez l'affichage.</p>
      </div>
      <div class="buttons-view__header-controls">
        <button
          type="button"
          @click="goToPreviousPage"
          :disabled="!activePage || pages.length <= 1 || pages[0]?.id === activePage?.id"
        >
          ◀
        </button>
        <span>Page {{ activePage?.index ?? 0 }} / {{ pages.length }}</span>
        <button
          type="button"
          @click="goToNextPage"
          :disabled="
            !activePage || pages.length <= 1 || pages[pages.length - 1]?.id === activePage?.id
          "
        >
          ▶
        </button>
        <button type="button" class="buttons-view__add" @click="handleAddPage" :disabled="pages.length >= 99">
          Nouvelle page
        </button>
      </div>
    </header>

    <section class="buttons-view__content" v-if="activePage">
      <div class="buttons-view__canvas">
        <div class="buttons-view__page-meta">
          <label>
            <span>Nom de la page</span>
            <input v-model="pageForm.name" type="text" @blur="savePageName" @keyup.enter="savePageName" />
          </label>
          <button type="button" class="buttons-view__delete" @click="handleRemovePage" :disabled="pages.length <= 1">
            Supprimer la page
          </button>
        </div>

        <div class="buttons-grid" role="grid" aria-label="Configuration des boutons">
          <button
            v-for="button in activePage.buttons"
            :key="button.instanceId"
            type="button"
            class="buttons-grid__item"
            :class="{ 'buttons-grid__item--selected': button.instanceId === selectedButtonId }"
            :style="{ '--accent': button.accentColor || '#1e293b' }"
            role="gridcell"
            @click="selectButton(button.instanceId)"
          >
            <div class="buttons-grid__content">
              <template v-if="button.display.mode === 'icon' && button.display.iconDataUrl">
                <img :src="button.display.iconDataUrl" alt="Icône personnalisée" />
              </template>
              <template v-else>
                <span>{{ button.display.text || 'Vide' }}</span>
              </template>
            </div>
            <footer class="buttons-grid__footer">
              <span>{{ button.pressBinding.targetType === 'none' ? '—' : button.pressBinding.targetType }}</span>
              <span>{{ button.releaseBinding.targetType === 'none' ? '—' : button.releaseBinding.targetType }}</span>
            </footer>
          </button>
        </div>
      </div>

      <aside v-if="selectedButton" class="button-editor">
        <header>
          <h3>Bouton sélectionné</h3>
          <p>Position {{ selectedButton.position + 1 }} — personnalisez l'entrée et les actions.</p>
        </header>

        <section class="button-editor__section">
          <h4>Affichage</h4>
          <div class="button-editor__display-mode">
            <label>
              <input
                type="radio"
                name="display-mode"
                value="text"
                :checked="selectedButton.display.mode === 'text'"
                @change="setDisplayMode('text')"
              />
              Texte
            </label>
            <label>
              <input
                type="radio"
                name="display-mode"
                value="icon"
                :checked="selectedButton.display.mode === 'icon'"
                @change="setDisplayMode('icon')"
              />
              Icône PNG
            </label>
          </div>

          <div v-if="selectedButton.display.mode === 'text'" class="button-editor__field">
            <label>
              <span>Texte du bouton</span>
              <input
                :value="selectedButton.display.text ?? ''"
                type="text"
                maxlength="24"
                placeholder="Titre du bouton"
                @input="updateDisplayText(($event.target as HTMLInputElement).value)"
              />
            </label>
            <button type="button" class="button-editor__ghost" @click="clearDisplayText">Effacer</button>
          </div>

          <div v-else class="button-editor__field">
            <div class="button-editor__icon-preview">
              <img v-if="selectedButton.display.iconDataUrl" :src="selectedButton.display.iconDataUrl" alt="Prévisualisation" />
              <span v-else>Choisissez un PNG 72x72</span>
            </div>
            <label class="button-editor__upload">
              <span>Icône PNG</span>
              <input type="file" accept="image/png" @change="handleIconUpload" />
            </label>
            <button type="button" class="button-editor__ghost" @click="clearIcon">Supprimer l'icône</button>
          </div>

          <div class="button-editor__field">
            <label>
              <span>Couleur d'accent</span>
              <input
                :value="selectedButton.accentColor ?? '#1e293b'"
                type="color"
                @input="updateAccentColor(($event.target as HTMLInputElement).value)"
              />
            </label>
          </div>
        </section>

        <section class="button-editor__section">
          <h4>Type d'entrée</h4>
          <select :value="selectedButton.inputType" @change="updateInputType(($event.target as HTMLSelectElement).value as ActionInputType)">
            <option value="button">Pression simple</option>
            <option value="ramp">Rampe / Fader</option>
          </select>
        </section>

        <section class="button-editor__section">
          <h4>Action au press</h4>
          <div class="button-editor__field">
            <label>
              <span>Type de cible</span>
              <select
                :value="selectedButton.pressBinding.targetType"
                @change="updateBindingType('press', ($event.target as HTMLSelectElement).value as StreamDeckActionTargetType)"
              >
                <option value="none">Aucune</option>
                <option value="preset">Preset</option>
                <option value="action">Action</option>
              </select>
            </label>
          </div>
          <div v-if="selectedButton.pressBinding.targetType === 'preset'" class="button-editor__field">
            <label>
              <span>Preset à rappeler</span>
              <select
                :value="selectedButton.pressBinding.targetId ?? ''"
                @change="updateBindingTarget('press', ($event.target as HTMLSelectElement).value || null)"
              >
                <option value="">Sélectionnez un preset</option>
                <option v-for="preset in presetOptions" :key="preset.id" :value="preset.id">{{ preset.label }}</option>
              </select>
            </label>
          </div>
          <div v-else-if="selectedButton.pressBinding.targetType === 'action'" class="button-editor__field">
            <label>
              <span>Action à exécuter</span>
              <select
                :value="selectedButton.pressBinding.targetId ?? ''"
                @change="updateBindingTarget('press', ($event.target as HTMLSelectElement).value || null)"
              >
                <option value="">Sélectionnez une action</option>
                <option v-for="action in actionOptions" :key="action.id" :value="action.id">{{ action.label }}</option>
              </select>
            </label>
          </div>
        </section>

        <section class="button-editor__section">
          <h4>Action au relâchement</h4>
          <div class="button-editor__field">
            <label>
              <span>Type de cible</span>
              <select
                :value="selectedButton.releaseBinding.targetType"
                @change="updateBindingType('release', ($event.target as HTMLSelectElement).value as StreamDeckActionTargetType)"
              >
                <option value="none">Aucune</option>
                <option value="preset">Preset</option>
                <option value="action">Action</option>
              </select>
            </label>
          </div>
          <div v-if="selectedButton.releaseBinding.targetType === 'preset'" class="button-editor__field">
            <label>
              <span>Preset à rappeler</span>
              <select
                :value="selectedButton.releaseBinding.targetId ?? ''"
                @change="updateBindingTarget('release', ($event.target as HTMLSelectElement).value || null)"
              >
                <option value="">Sélectionnez un preset</option>
                <option v-for="preset in presetOptions" :key="preset.id" :value="preset.id">{{ preset.label }}</option>
              </select>
            </label>
          </div>
          <div v-else-if="selectedButton.releaseBinding.targetType === 'action'" class="button-editor__field">
            <label>
              <span>Action à exécuter</span>
              <select
                :value="selectedButton.releaseBinding.targetId ?? ''"
                @change="updateBindingTarget('release', ($event.target as HTMLSelectElement).value || null)"
              >
                <option value="">Sélectionnez une action</option>
                <option v-for="action in actionOptions" :key="action.id" :value="action.id">{{ action.label }}</option>
              </select>
            </label>
          </div>
        </section>

        <section class="button-editor__section button-editor__actions">
          <button type="button" class="button-editor__ghost" @click="logTest('press')">Tester press</button>
          <button type="button" class="button-editor__ghost" @click="logTest('release')">Tester release</button>
          <button type="button" class="button-editor__reset" @click="resetButton">Réinitialiser</button>
        </section>
      </aside>
    </section>

    <section v-if="recentEvents.length" class="buttons-view__events">
      <h3>Historique des tests</h3>
      <ul>
        <li v-for="event in recentEvents" :key="`${event.timestamp}-${event.trigger}`">
          <span class="event-time">{{ new Date(event.timestamp).toLocaleTimeString() }}</span>
          <span class="event-trigger">{{ event.trigger === 'press' ? 'Press' : 'Release' }}</span>
          <span class="event-target">
            <template v-if="event.targetType === 'none'">aucune action</template>
            <template v-else>{{ event.targetType }} — {{ event.targetId ?? 'non défini' }}</template>
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.buttons-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.buttons-view__header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.25rem;
  padding: 1.5rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 1.5rem;
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.35);
}

.buttons-view__header h2 {
  margin: 0;
}

.buttons-view__header p {
  margin: 0.35rem 0 0;
  max-width: 48ch;
  color: rgba(148, 163, 184, 0.85);
}

.buttons-view__header-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.buttons-view__header-controls button {
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(30, 41, 59, 0.85);
  color: #e2e8f0;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.buttons-view__header-controls button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.buttons-view__header-controls button:not(:disabled):hover {
  background: rgba(59, 130, 246, 0.25);
  border-color: rgba(59, 130, 246, 0.45);
  transform: translateY(-1px);
}

.buttons-view__add {
  background: rgba(99, 102, 241, 0.2) !important;
  border-color: rgba(129, 140, 248, 0.55) !important;
}

.buttons-view__content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 1.5rem;
}

.buttons-view__canvas {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: rgba(10, 17, 30, 0.82);
  border: 1px solid rgba(59, 70, 88, 0.35);
  border-radius: 1.5rem;
  padding: 1.25rem;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.35);
}

.buttons-view__page-meta {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-end;
}

.buttons-view__page-meta label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1;
  font-size: 0.9rem;
  color: rgba(148, 163, 184, 0.85);
}

.buttons-view__page-meta input {
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.85);
  color: #e2e8f0;
  padding: 0.55rem 0.75rem;
}

.buttons-view__delete {
  border-radius: 0.9rem;
  border: 1px solid rgba(248, 113, 113, 0.45);
  background: rgba(248, 113, 113, 0.15);
  color: #fecaca;
  padding: 0.55rem 0.9rem;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.buttons-view__delete:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.buttons-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 0.75rem;
}

.buttons-grid__item {
  position: relative;
  border-radius: 1rem;
  border: 2px solid transparent;
  background: rgba(30, 41, 59, 0.75);
  color: #f8fafc;
  min-height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.buttons-grid__item::before {
  content: '';
  position: absolute;
  inset: 6px;
  border-radius: 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.15);
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.85), rgba(15, 23, 42, 0.65));
  opacity: 0.9;
}

.buttons-grid__item:hover::before {
  opacity: 1;
}

.buttons-grid__item:hover {
  transform: translateY(-2px);
  border-color: rgba(129, 140, 248, 0.45);
  box-shadow: 0 18px 40px rgba(99, 102, 241, 0.25);
}

.buttons-grid__item--selected {
  border-color: rgba(56, 189, 248, 0.85);
  box-shadow: 0 24px 45px rgba(56, 189, 248, 0.35);
}

.buttons-grid__item--selected::before {
  border-color: rgba(56, 189, 248, 0.35);
}

.buttons-grid__item .buttons-grid__content,
.buttons-grid__item footer {
  position: relative;
  z-index: 1;
}

.buttons-grid__content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  text-align: center;
  width: 100%;
  height: 100%;
}

.buttons-grid__content img {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.buttons-grid__footer {
  width: 100%;
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  color: rgba(148, 163, 184, 0.85);
  margin-top: 0.45rem;
}

.button-editor {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: rgba(10, 17, 30, 0.82);
  border: 1px solid rgba(59, 70, 88, 0.35);
  border-radius: 1.5rem;
  padding: 1.25rem;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.35);
}

.button-editor header h3 {
  margin: 0;
}

.button-editor header p {
  margin: 0.3rem 0 0;
  color: rgba(148, 163, 184, 0.8);
}

.button-editor__section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.button-editor__display-mode {
  display: flex;
  gap: 1rem;
  font-size: 0.95rem;
}

.button-editor__display-mode label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
  color: rgba(226, 232, 240, 0.85);
}

.button-editor__field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.button-editor__field input,
.button-editor__field select {
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.85);
  color: #e2e8f0;
  padding: 0.55rem 0.75rem;
}

.button-editor__field input[type='file'] {
  padding: 0.35rem 0.75rem;
}

.button-editor__ghost {
  border-radius: 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(30, 41, 59, 0.6);
  color: rgba(226, 232, 240, 0.85);
  padding: 0.45rem 0.75rem;
  cursor: pointer;
  align-self: flex-start;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.button-editor__ghost:hover {
  border-color: rgba(129, 140, 248, 0.5);
  background: rgba(79, 70, 229, 0.2);
}

.button-editor__icon-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.9rem;
  border: 1px dashed rgba(148, 163, 184, 0.45);
  min-height: 90px;
  background: rgba(15, 23, 42, 0.6);
  color: rgba(148, 163, 184, 0.85);
}

.button-editor__icon-preview img {
  width: 72px;
  height: 72px;
  object-fit: contain;
}

.button-editor__upload {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: rgba(148, 163, 184, 0.85);
}

.button-editor__actions {
  display: flex;
  gap: 0.75rem;
}

.button-editor__reset {
  border-radius: 0.85rem;
  border: 1px solid rgba(248, 113, 113, 0.45);
  background: rgba(248, 113, 113, 0.18);
  color: #fecaca;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.button-editor__reset:hover {
  border-color: rgba(248, 113, 113, 0.65);
  background: rgba(248, 113, 113, 0.25);
}

.buttons-view__events {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(59, 70, 88, 0.35);
  border-radius: 1.5rem;
  padding: 1.25rem;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.35);
}

.buttons-view__events h3 {
  margin: 0 0 0.75rem 0;
}

.buttons-view__events ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.55rem;
}

.buttons-view__events li {
  display: grid;
  grid-template-columns: 90px 90px 1fr;
  gap: 0.75rem;
  font-size: 0.9rem;
  color: rgba(226, 232, 240, 0.85);
  background: rgba(15, 23, 42, 0.6);
  border-radius: 0.9rem;
  padding: 0.65rem 0.75rem;
}

.event-time {
  font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', monospace;
  color: rgba(148, 163, 184, 0.85);
}

.event-trigger {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.75rem;
  color: rgba(59, 130, 246, 0.85);
}

.event-target {
  color: rgba(226, 232, 240, 0.85);
}

@media (max-width: 1200px) {
  .buttons-view__content {
    grid-template-columns: 1fr;
  }

  .button-editor {
    order: -1;
  }
}
</style>
