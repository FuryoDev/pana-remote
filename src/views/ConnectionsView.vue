<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useControlStore } from '../composables/useControlStore'
import type { ConnectionStatus, ControllerConnection } from '../types/connections'

// Le store centralise l'état partagé (connexions, presets, surface de contrôle, etc.).
const store = useControlStore()

const connections = computed(() => store.connections.value)

// Cette ref garde l'identifiant de la connexion que l'on édite dans le panneau droit.
const selectedId = ref<string | null>(connections.value[0]?.id ?? null)
const isCreationOpen = ref(false)
const sidebarTab = ref<'connections' | 'control'>('connections')

// Le catalogue ci-dessous reconstitue les emplacements physiques de la salle.
// Une seule caméra est réellement connectée, les 9 autres servent de repères métiers.
const placeholderCameraCatalog = [
  {
    id: 'auditorium-wide',
    label: 'Vue générale auditorium',
    location: 'Auditorium',
    model: 'CR-N500',
    note: 'Repère principal pour les plans larges de l’assemblée.',
  },
  {
    id: 'auditorium-left',
    label: 'Bloc audience gauche',
    location: 'Auditorium',
    model: 'CR-N300',
    note: 'Prévu pour les réactions de la rangée gauche.',
  },
  {
    id: 'auditorium-right',
    label: 'Bloc audience droite',
    location: 'Auditorium',
    model: 'CR-N300',
    note: 'Prévu pour les réactions de la rangée droite.',
  },
  {
    id: 'balcony',
    label: 'Balcon arrière',
    location: 'Mezzanine',
    model: 'CR-N100',
    note: 'Prise de vue plongeante pour valoriser la salle.',
  },
  {
    id: 'foyer',
    label: 'Hall d’accueil',
    location: 'Hall',
    model: 'CR-N100',
    note: 'Aperçu ambiance avant le culte.',
  },
  {
    id: 'stage-left',
    label: 'Plateau côté gauche',
    location: 'Plateau',
    model: 'CR-N500',
    note: 'Plan serré des musiciens côté gauche.',
  },
  {
    id: 'stage-right',
    label: 'Plateau côté droit',
    location: 'Plateau',
    model: 'CR-N500',
    note: 'Plan serré des musiciens côté droit.',
  },
  {
    id: 'control-room',
    label: 'Control room',
    location: 'Régie',
    model: 'CR-N300',
    note: 'Espace réservé aux tests techniques.',
  },
  {
    id: 'outdoor',
    label: 'Extérieur accueil',
    location: 'Parvis',
    model: 'CR-X300',
    note: 'Plan d’ambiance extérieur avant l’entrée.',
  },
]

const itemsPerPageOptions = [4, 6, 10] as const
const galleryControls = reactive<{ perPage: number; page: number }>({
  perPage: itemsPerPageOptions[0] ?? 4,
  page: 1,
})

// On dissocie l’aperçu visuel de la sélection côté formulaire pour pouvoir afficher les placeholders.
const activeSlotId = ref<string | null>(connections.value[0]?.id ?? null)

type GalleryConnectionSlot = {
  type: 'connection'
  id: string
  label: string
  model: string
  address: string
  status: ConnectionStatus
  note: string
  connection: ControllerConnection
}

type GalleryPlaceholderSlot = {
  type: 'placeholder'
  id: string
  label: string
  model: string
  address: string
  note: string
  location: string
}

type GallerySlot = GalleryConnectionSlot | GalleryPlaceholderSlot

const gallerySlots = computed<GallerySlot[]>(() => {
  const connectionSlots: GalleryConnectionSlot[] = connections.value.map((connection) => ({
    type: 'connection',
    id: connection.id,
    label: connection.label,
    model: connection.cameraModel,
    address: `${connection.address}:${connection.httpPort}`,
    status: connection.status,
    note: connection.notes ?? 'Flux en direct disponible.',
    connection,
  }))

  const placeholders: GalleryPlaceholderSlot[] = placeholderCameraCatalog.map((camera) => ({
    type: 'placeholder',
    id: `placeholder-${camera.id}`,
    label: camera.label,
    model: camera.model,
    address: 'Adresse à définir',
    note: camera.note,
    location: `${camera.location}`,
  }))

  return [...connectionSlots, ...placeholders].slice(0, 10)
})

const totalPages = computed(() => Math.max(1, Math.ceil(gallerySlots.value.length / galleryControls.perPage)))

const paginatedSlots = computed(() => {
  const start = (galleryControls.page - 1) * galleryControls.perPage
  return gallerySlots.value.slice(start, start + galleryControls.perPage)
})

watch(
  gallerySlots,
  (slots) => {
    if (!slots.length) {
      activeSlotId.value = null
      return
    }
    if (!activeSlotId.value || !slots.some((slot) => slot.id === activeSlotId.value)) {
      const fallbackSlot = slots.find((slot) => slot.type === 'connection') ?? slots[0] ?? null
      if (fallbackSlot) {
        activeSlotId.value = fallbackSlot.id
      }
    }
  },
  { immediate: true },
)

watch(
  connections,
  (list) => {
    if (!list.length) {
      selectedId.value = null
      // Sans caméra connectée on ouvre directement le formulaire pour guider l’utilisateur.
      isCreationOpen.value = true
      return
    }
    if (!selectedId.value || !list.some((connection) => connection.id === selectedId.value)) {
      const first = list[0]
      if (first) {
        selectedId.value = first.id
      }
    }
  },
  { immediate: true },
)

const activeSlot = computed(() => gallerySlots.value.find((slot) => slot.id === activeSlotId.value) ?? null)

const selectedConnection = computed(
  () => connections.value.find((connection) => connection.id === selectedId.value) ?? null,
)

watch(selectedConnection, (connection) => {
  if (connection) {
    activeSlotId.value = connection.id
  }
})

const previewTitle = computed(() => activeSlot.value?.label ?? 'Aucune caméra sélectionnée')
const previewSubtitle = computed(() => {
  if (!activeSlot.value) {
    return 'Sélectionnez une caméra pour afficher un aperçu.'
  }
  if (activeSlot.value.type === 'connection') {
    return activeSlot.value.address
  }
  return `${activeSlot.value.location} • ${activeSlot.value.model}`
})
const previewStatus = computed(() => {
  if (!activeSlot.value) {
    return 'Hors ligne'
  }
  if (activeSlot.value.type === 'connection') {
    return statusLabels[activeSlot.value.status]
  }
  return 'Emplacement libre'
})
const previewStatusClass = computed(() => {
  if (activeSlot.value?.type === 'connection') {
    return statusClass[activeSlot.value.status]
  }
  return 'status-pill--idle'
})
const previewNote = computed(() => {
  if (!activeSlot.value) {
    return ''
  }
  return activeSlot.value.note
})

const creationForm = reactive({
  label: '',
  address: '',
  httpPort: 80,
  cameraModel: 'CR-N500',
  autoConnect: true,
  notes: '',
})

const cameraModels = ['CR-N500', 'CR-N300', 'CR-N100', 'CR-X500', 'CR-X300']

function resetCreationForm() {
  creationForm.label = ''
  creationForm.address = ''
  creationForm.httpPort = 80
  creationForm.cameraModel = 'CR-N500'
  creationForm.autoConnect = true
  creationForm.notes = ''
}

function handleCreateConnection() {
  if (!creationForm.label.trim() || !creationForm.address.trim()) {
    return
  }
  const connection = store.createConnection({
    label: creationForm.label,
    address: creationForm.address,
    httpPort: creationForm.httpPort,
    cameraModel: creationForm.cameraModel,
    autoConnect: creationForm.autoConnect,
    notes: creationForm.notes,
  })
  resetCreationForm()
  selectedId.value = connection.id
  activeSlotId.value = connection.id
  isCreationOpen.value = false
}

function selectSlot(slot: GallerySlot) {
  activeSlotId.value = slot.id
  if (slot.type === 'connection') {
    selectedId.value = slot.id
  }
}

function toggleCreationForm() {
  isCreationOpen.value = !isCreationOpen.value
  if (isCreationOpen.value) {
    resetCreationForm()
  }
}

function cancelCreation() {
  resetCreationForm()
  isCreationOpen.value = false
}

function toggleCreationForm() {
  isCreationOpen.value = !isCreationOpen.value
  if (isCreationOpen.value) {
    resetCreationForm()
  }
}

function cancelCreation() {
  resetCreationForm()
  isCreationOpen.value = false
}

function updateConnection(
  field: 'label' | 'address' | 'httpPort' | 'cameraModel' | 'autoConnect' | 'notes',
  value: string | number | boolean,
) {
  if (!selectedConnection.value) return
  const updates: Partial<ControllerConnection> = { [field]: value } as Partial<ControllerConnection>
  store.updateConnection(selectedConnection.value.id, updates)
}

function removeSelected() {
  if (!selectedConnection.value) return
  const currentIndex = connections.value.findIndex((connection) => connection.id === selectedConnection.value?.id)
  store.removeConnection(selectedConnection.value.id)
  const next = connections.value[currentIndex] ?? connections.value[currentIndex - 1]
  selectedId.value = next?.id ?? connections.value[0]?.id ?? null
}

function setStatus(status: ConnectionStatus) {
  if (!selectedConnection.value) return
  store.updateConnectionStatus(selectedConnection.value.id, status)
}

function testConnection() {
  if (!selectedConnection.value) return
  setStatus('connecting')
  window.setTimeout(() => {
    setStatus('connected')
  }, 900)
}

function changePerPage(value: number) {
  galleryControls.perPage = value
  galleryControls.page = 1
}

function goToPreviousPage() {
  galleryControls.page = Math.max(1, galleryControls.page - 1)
}

function goToNextPage() {
  galleryControls.page = Math.min(totalPages.value, galleryControls.page + 1)
}

const presetCount = computed(() => store.presets.value.length)
const deckPageCount = computed(() => store.deckPages.value.length)
const configuredActionCount = computed(() => store.configuredActions.value.length)

const statusLabels: Record<ConnectionStatus, string> = {
  disconnected: 'Déconnectée',
  connecting: 'Connexion en cours…',
  connected: 'Connectée',
  error: 'Erreur',
}

const statusClass: Record<ConnectionStatus, string> = {
  disconnected: 'status-pill--idle',
  connecting: 'status-pill--pending',
  connected: 'status-pill--success',
  error: 'status-pill--error',
}
</script>

<template>
  <div class="connections-view">
    <section class="connections-view__monitor">
      <header class="connections-view__monitor-header">
        <div>
          <h2>Vue opérateur</h2>
          <p>
            Surveillez le flux principal et gardez un œil sur les emplacements prévus avant de lancer un culte.
          </p>
        </div>
        <div class="connections-view__monitor-controls">
          <label>
            <span>Caméras par page</span>
            <select
              :value="galleryControls.perPage"
              @change="changePerPage(Number(($event.target as HTMLSelectElement).value))"
            >
              <option v-for="option in itemsPerPageOptions" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </label>
        </div>
      </header>

      <!-- Galerie des caméras réelles + placeholders -->
      <ul class="connections-view__gallery">
        <li v-for="slot in paginatedSlots" :key="slot.id">
          <button
            type="button"
            class="connections-view__gallery-item"
            :class="{ 'connections-view__gallery-item--active': slot.id === activeSlotId }"
            @click="selectSlot(slot)"
          >
            <span class="connections-view__gallery-label">{{ slot.label }}</span>
            <small class="connections-view__gallery-meta">
              {{ slot.type === 'connection' ? slot.address : slot.note }}
            </small>
            <span
              class="status-pill"
              :class="slot.type === 'connection' ? statusClass[slot.status] : 'status-pill--idle'"
            >
              {{ slot.type === 'connection' ? statusLabels[slot.status] : 'Placeholder' }}
            </span>
          </button>
        </li>
      </ul>

      <footer v-if="totalPages > 1" class="connections-view__pagination">
        <button type="button" @click="goToPreviousPage" :disabled="galleryControls.page === 1">Précédent</button>
        <span>Page {{ galleryControls.page }} / {{ totalPages }}</span>
        <button type="button" @click="goToNextPage" :disabled="galleryControls.page === totalPages">Suivant</button>
      </footer>

      <!-- Aperçu centré de la caméra sélectionnée -->
      <aside class="connections-view__preview">
        <header>
          <h3>{{ previewTitle }}</h3>
          <span class="status-pill" :class="previewStatusClass">{{ previewStatus }}</span>
        </header>
        <p class="connections-view__preview-subtitle">{{ previewSubtitle }}</p>
        <div class="connections-view__preview-screen">
          <div class="connections-view__preview-overlay">
            {{
              activeSlot?.type === 'connection' && activeSlot.connection.status === 'connected'
                ? 'Flux en direct'
                : 'Signal en attente'
            }}
          </div>
        </div>
        <p v-if="previewNote" class="connections-view__preview-note">{{ previewNote }}</p>
      </aside>
    </section>

    <section class="connections-view__sidebar">
      <div class="connections-view__tabs">
        <button
          type="button"
          class="connections-view__tab"
          :class="{ 'connections-view__tab--active': sidebarTab === 'connections' }"
          @click="sidebarTab = 'connections'"
        >
          Connexions
        </button>
        <button
          type="button"
          class="connections-view__tab"
          :class="{ 'connections-view__tab--active': sidebarTab === 'control' }"
          @click="sidebarTab = 'control'"
        >
          Affectations &amp; UI
        </button>
      </div>

      <div v-if="sidebarTab === 'connections'" class="connections-view__panel">
        <header class="connections-view__panel-header">
          <div>
            <h3>Gestion des connexions</h3>
            <p>Ajoutez une caméra IP ou modifiez les paramètres de l’équipement sélectionné.</p>
          </div>
          <button type="button" class="ghost" @click="toggleCreationForm">
            {{ isCreationOpen ? 'Fermer le formulaire' : 'Ajouter une connexion' }}
          </button>
        </header>

        <form v-if="isCreationOpen" class="connections-view__form" @submit.prevent="handleCreateConnection">
          <label>
            <span>Label</span>
            <input v-model="creationForm.label" type="text" required placeholder="Caméra 2" />
          </label>
          <label>
            <span>Adresse IP</span>
            <input v-model="creationForm.address" type="text" required placeholder="192.168.0.10" />
          </label>
          <label>
            <span>Port HTTP</span>
            <input v-model.number="creationForm.httpPort" type="number" min="1" max="65535" />
          </label>
          <label>
            <span>Modèle</span>
            <select v-model="creationForm.cameraModel">
              <option v-for="model in cameraModels" :key="model" :value="model">{{ model }}</option>
            </select>
          </label>
          <label class="connections-view__checkbox">
            <input v-model="creationForm.autoConnect" type="checkbox" />
            Connexion automatique
          </label>
          <label class="connections-view__textarea">
            <span>Notes</span>
            <textarea v-model="creationForm.notes" rows="2" placeholder="Ajouter des notes"></textarea>
          </label>
          <div class="connections-view__form-actions">
            <button type="submit" class="primary">Créer la connexion</button>
            <button type="button" class="ghost" @click="cancelCreation">Annuler</button>
          </div>
        </form>

        <ul class="connections-view__items">
          <li v-for="connection in connections" :key="connection.id">
            <button
              type="button"
              class="connections-view__item"
              :class="{ 'connections-view__item--active': connection.id === selectedId }"
              @click="selectedId = connection.id"
            >
              <div class="connections-view__item-header">
                <span class="connections-view__item-label">{{ connection.label }}</span>
                <span class="status-pill" :class="statusClass[connection.status]">
                  {{ statusLabels[connection.status] }}
                </span>
              </div>
              <dl>
                <div>
                  <dt>Adresse</dt>
                  <dd>{{ connection.address }}:{{ connection.httpPort }}</dd>
                </div>
                <div>
                  <dt>Modèle</dt>
                  <dd>{{ connection.cameraModel }}</dd>
                </div>
                <div>
                  <dt>Auto</dt>
                  <dd>{{ connection.autoConnect ? 'Oui' : 'Non' }}</dd>
                </div>
              </dl>
              <p v-if="connection.notes" class="connections-view__notes">{{ connection.notes }}</p>
            </button>
          </li>
        </ul>

        <section v-if="selectedConnection" class="connections-view__details">
          <header class="connections-view__details-header">
            <div>
              <h4>{{ selectedConnection.label }}</h4>
              <p>Mettre à jour l’identification réseau et l’état de suivi.</p>
            </div>
            <button type="button" class="connections-view__danger" @click="removeSelected">Supprimer</button>
          </header>

          <div class="connections-view__grid">
            <label>
              <span>Label</span>
              <input
                :value="selectedConnection.label"
                type="text"
                @change="updateConnection('label', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label>
              <span>Adresse IP</span>
              <input
                :value="selectedConnection.address"
                type="text"
                @change="updateConnection('address', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label>
              <span>Port HTTP</span>
              <input
                :value="selectedConnection.httpPort"
                type="number"
                min="1"
                max="65535"
                @change="updateConnection('httpPort', Number(($event.target as HTMLInputElement).value))"
              />
            </label>
            <label>
              <span>Modèle</span>
              <select :value="selectedConnection.cameraModel" @change="updateConnection('cameraModel', ($event.target as HTMLSelectElement).value)">
                <option v-for="model in cameraModels" :key="model" :value="model">{{ model }}</option>
              </select>
            </label>
            <label class="connections-view__toggle">
              <input
                :checked="selectedConnection.autoConnect"
                type="checkbox"
                @change="updateConnection('autoConnect', ($event.target as HTMLInputElement).checked)"
              />
              Connexion automatique au démarrage
            </label>
            <label class="connections-view__textarea">
              <span>Notes</span>
              <textarea
                :value="selectedConnection.notes ?? ''"
                rows="3"
                placeholder="Information complémentaire"
                @change="updateConnection('notes', ($event.target as HTMLTextAreaElement).value)"
              ></textarea>
            </label>
          </div>

          <div class="connections-view__status">
            <div>
              <span class="status-pill" :class="statusClass[selectedConnection.status]">
                {{ statusLabels[selectedConnection.status] }}
              </span>
              <span class="connections-view__status-meta">
                Dernière mise à jour :
                <strong>{{ selectedConnection.lastUpdated ? new Date(selectedConnection.lastUpdated).toLocaleTimeString() : 'Jamais' }}</strong>
              </span>
            </div>
            <div class="connections-view__status-actions">
              <button type="button" @click="testConnection">Tester la connexion</button>
              <button type="button" @click="setStatus('error')">Simuler une erreur</button>
              <button type="button" @click="setStatus('disconnected')">Forcer déconnexion</button>
            </div>
          </div>
        </section>
      </div>

      <div v-else class="connections-view__panel">
        <header class="connections-view__panel-header">
          <div>
            <h3>Surface de contrôle</h3>
            <p>Vue synthétique des presets, actions et pages Stream Deck configurés.</p>
          </div>
        </header>

        <ul class="connections-view__control-stats">
          <li>
            <strong>{{ presetCount }}</strong>
            <span>Presets disponibles</span>
          </li>
          <li>
            <strong>{{ deckPageCount }}</strong>
            <span>Pages Stream Deck</span>
          </li>
          <li>
            <strong>{{ configuredActionCount }}</strong>
            <span>Actions configurées</span>
          </li>
        </ul>

        <p class="connections-view__control-hint">
          Utilisez l’onglet « Actions » et la page « Stream Deck » pour modifier ces éléments. Ce résumé
          rappelle à l’opérateur ce qui est prêt avant le démarrage du direct.
        </p>
      </div>

      <section class="connections-view__placeholders">
        <h4>Caméras placeholder</h4>
        <p>Ces entrées permettent de documenter l'implantation physique en attendant une vraie découverte automatique.</p>
        <ul>
          <!-- Cette liste matérialise la vision métier des emplacements sans créer de vraies connexions. -->
          <li v-for="camera in placeholderCatalog" :key="camera.id" :class="{ 'connections-view__placeholders-item--active': camera.isActive }">
            <strong>{{ camera.label }}</strong>
            <span>{{ camera.location }} • {{ camera.model }}</span>
            <small>{{ camera.note }}</small>
          </li>
        </ul>
      </section>
    </section>
  </div>
</template>

<style scoped>
.connections-view {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  gap: 1.5rem;
}

.connections-view__monitor,
.connections-view__sidebar {
  background: rgba(10, 17, 30, 0.82);
  border: 1px solid rgba(59, 70, 88, 0.35);
  border-radius: 1.5rem;
  padding: 1.5rem;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.35);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.connections-view__monitor-header {
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
  align-items: flex-start;
}

.connections-view__monitor-header h2 {
  margin: 0;
}

.connections-view__monitor-header p {
  margin: 0.35rem 0 0;
  color: rgba(148, 163, 184, 0.8);
}

.connections-view__monitor-controls label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: rgba(148, 163, 184, 0.85);
}

.connections-view__monitor-controls select {
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.85);
  color: #e2e8f0;
  padding: 0.45rem 0.75rem;
}

.connections-view__gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.9rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.connections-view__gallery-item {
  width: 100%;
  text-align: left;
  border-radius: 1rem;
  border: 1px solid rgba(59, 70, 88, 0.35);
  background: rgba(15, 23, 42, 0.65);
  color: #e2e8f0;
  padding: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;
}

.connections-view__gallery-item:hover {
  border-color: rgba(56, 189, 248, 0.45);
  transform: translateY(-2px);
}

.connections-view__gallery-item--active {
  border-color: rgba(79, 70, 229, 0.65);
  background: rgba(79, 70, 229, 0.22);
}

.connections-view__gallery-label {
  font-size: 1rem;
  font-weight: 600;
}

.connections-view__gallery-meta {
  color: rgba(148, 163, 184, 0.8);
}

.connections-view__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.connections-view__pagination button {
  border-radius: 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(30, 41, 59, 0.6);
  color: rgba(226, 232, 240, 0.88);
  padding: 0.45rem 0.95rem;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.connections-view__pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.connections-view__pagination button:not(:disabled):hover {
  border-color: rgba(129, 140, 248, 0.45);
  background: rgba(79, 70, 229, 0.22);
}

.connections-view__preview {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.5rem;
  border-radius: 1.25rem;
  border: 1px solid rgba(59, 70, 88, 0.35);
  background: rgba(12, 20, 33, 0.7);
}

.connections-view__preview header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.connections-view__preview h3 {
  margin: 0;
}

.connections-view__preview-subtitle {
  margin: 0;
  color: rgba(148, 163, 184, 0.8);
}

.connections-view__preview-screen {
  position: relative;
  border-radius: 1rem;
  border: 1px solid rgba(79, 70, 229, 0.25);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(14, 165, 233, 0.25));
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.connections-view__preview-overlay {
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.9);
  background: rgba(15, 23, 42, 0.65);
  padding: 0.65rem 1.1rem;
  border-radius: 999px;
  border: 1px solid rgba(226, 232, 240, 0.2);
}

.connections-view__preview-note {
  margin: 0;
  color: rgba(148, 163, 184, 0.8);
}

.connections-view__tabs {
  display: flex;
  gap: 0.75rem;
}

.connections-view__tab {
  flex: 1;
  border-radius: 1rem;
  border: 1px solid rgba(79, 70, 229, 0.35);
  background: rgba(15, 23, 42, 0.6);
  color: #e2e8f0;
  padding: 0.65rem 0.95rem;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.connections-view__tab--active {
  background: rgba(79, 70, 229, 0.22);
  border-color: rgba(79, 70, 229, 0.65);
}

.connections-view__panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.connections-view__panel-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.connections-view__panel-header h3 {
  margin: 0;
}

.connections-view__panel-header p {
  margin: 0.35rem 0 0;
  color: rgba(148, 163, 184, 0.8);
}

.connections-view__panel-header .ghost {
  border-radius: 0.9rem;
  border: 1px solid rgba(129, 140, 248, 0.55);
  background: rgba(79, 70, 229, 0.22);
  color: #eef2ff;
  padding: 0.55rem 1rem;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
}

.connections-view__panel-header .ghost:hover {
  transform: translateY(-1px);
  background: rgba(99, 102, 241, 0.32);
}

.connections-view__form {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 1.1rem;
  border: 1px solid rgba(59, 70, 88, 0.35);
  background: rgba(15, 23, 42, 0.55);
}

.connections-view__form label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: rgba(148, 163, 184, 0.85);
}

.connections-view__form input,
.connections-view__form select,
.connections-view__form textarea {
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.85);
  color: #e2e8f0;
  padding: 0.55rem 0.75rem;
}

.connections-view__form textarea {
  resize: vertical;
}

.connections-view__form-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.connections-view__textarea textarea {
  min-height: 90px;
}

.connections-view__form-actions {
  display: flex;
  gap: 0.75rem;
  grid-column: 1 / -1;
}

.connections-view__form-actions .primary,
.connections-view__form-actions .ghost {
  border-radius: 0.9rem;
  padding: 0.55rem 1.1rem;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
}

.connections-view__form-actions .primary {
  border: 1px solid rgba(56, 189, 248, 0.65);
  background: rgba(56, 189, 248, 0.15);
  color: #cffafe;
}

.connections-view__form-actions .primary:hover {
  transform: translateY(-1px);
  background: rgba(56, 189, 248, 0.25);
}

.connections-view__form-actions .ghost {
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: transparent;
  color: #cbd5f5;
}

.connections-view__form-actions .ghost:hover {
  transform: translateY(-1px);
  background: rgba(148, 163, 184, 0.15);
}

.connections-view__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}

.connections-view__item {
  width: 100%;
  text-align: left;
  border-radius: 1.1rem;
  border: 1px solid rgba(59, 70, 88, 0.35);
  background: rgba(15, 23, 42, 0.65);
  color: #e2e8f0;
  display: grid;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;
}

.connections-view__item:hover {
  border-color: rgba(56, 189, 248, 0.45);
  transform: translateY(-1px);
}

.connections-view__item--active {
  border-color: rgba(79, 70, 229, 0.65);
  background: rgba(79, 70, 229, 0.22);
}

.connections-view__item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.connections-view__item-label {
  font-weight: 600;
}

.connections-view__item dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
  margin: 0;
}

.connections-view__item dt {
  font-size: 0.75rem;
  color: rgba(148, 163, 184, 0.75);
}

.connections-view__item dd {
  margin: 0;
}

.connections-view__notes {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(148, 163, 184, 0.8);
}

.connections-view__details {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  padding: 1.1rem;
  border-radius: 1.1rem;
  border: 1px solid rgba(59, 70, 88, 0.35);
  background: rgba(12, 20, 33, 0.65);
}

.connections-view__details-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.connections-view__details-header h4 {
  margin: 0;
}

.connections-view__details-header p {
  margin: 0.35rem 0 0;
  color: rgba(148, 163, 184, 0.8);
}

.connections-view__danger {
  border-radius: 0.85rem;
  border: 1px solid rgba(248, 113, 113, 0.45);
  background: rgba(248, 113, 113, 0.15);
  color: rgba(254, 226, 226, 0.9);
  padding: 0.45rem 0.85rem;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
}

.connections-view__danger:hover {
  transform: translateY(-1px);
  background: rgba(248, 113, 113, 0.25);
}

.connections-view__body {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 1rem;
}

.connections-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
}

.connections-view__grid label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: rgba(148, 163, 184, 0.85);
}

.connections-view__grid input,
.connections-view__grid select,
.connections-view__grid textarea {
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.85);
  color: #e2e8f0;
  padding: 0.55rem 0.75rem;
}

.connections-view__toggle {
  flex-direction: row !important;
  align-items: center;
  gap: 0.5rem;
}

.connections-view__preview {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  border-radius: 1.25rem;
  border: 1px solid rgba(59, 70, 88, 0.35);
  background: rgba(12, 19, 33, 0.78);
}

.connections-view__preview header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.connections-view__preview h4 {
  margin: 0;
}

.connections-view__preview-subtitle {
  margin: 0;
  color: rgba(148, 163, 184, 0.8);
}

.connections-view__preview-screen {
  position: relative;
  border-radius: 1rem;
  border: 1px solid rgba(79, 70, 229, 0.25);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(14, 165, 233, 0.25));
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.connections-view__preview-overlay {
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.9);
  background: rgba(15, 23, 42, 0.65);
  padding: 0.65rem 1.1rem;
  border-radius: 999px;
  border: 1px solid rgba(226, 232, 240, 0.2);
}

.connections-view__status {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.connections-view__status-meta {
  margin-left: 0.75rem;
  font-size: 0.85rem;
  color: rgba(148, 163, 184, 0.85);
}

.connections-view__status-actions {
  display: flex;
  gap: 0.75rem;
}

.connections-view__status-actions button {
  border-radius: 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(30, 41, 59, 0.6);
  color: rgba(226, 232, 240, 0.88);
  padding: 0.45rem 0.75rem;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.connections-view__status-actions button:hover {
  border-color: rgba(129, 140, 248, 0.45);
  background: rgba(79, 70, 229, 0.22);
}

.connections-view__control-stats {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
}

.connections-view__control-stats li {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1rem;
  border-radius: 1.1rem;
  border: 1px solid rgba(79, 70, 229, 0.25);
  background: rgba(79, 70, 229, 0.12);
}

.connections-view__control-stats strong {
  font-size: 1.6rem;
  color: #eef2ff;
}

.connections-view__control-stats span {
  color: rgba(148, 163, 184, 0.85);
}

.connections-view__control-hint {
  margin: 0;
  color: rgba(148, 163, 184, 0.8);
  line-height: 1.6;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border: 1px solid transparent;
}

.status-pill--idle {
  background: rgba(148, 163, 184, 0.18);
  border-color: rgba(148, 163, 184, 0.35);
  color: rgba(148, 163, 184, 0.95);
}

.status-pill--pending {
  background: rgba(251, 191, 36, 0.2);
  border-color: rgba(251, 191, 36, 0.4);
  color: #facc15;
}

.status-pill--success {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.4);
  color: #4ade80;
}

.status-pill--error {
  background: rgba(248, 113, 113, 0.2);
  border-color: rgba(248, 113, 113, 0.4);
  color: #fecaca;
}

@media (max-width: 1180px) {
  .connections-view {
    grid-template-columns: 1fr;
  }
}
</style>
