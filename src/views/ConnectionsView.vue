<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useControlStore } from '../composables/useControlStore'
import type { ConnectionStatus, ControllerConnection } from '../types/connections'

const store = useControlStore()

const connections = computed(() => store.connections.value)
const selectedId = ref<string | null>(connections.value[0]?.id ?? null)

watch(
  connections,
  (list) => {
    if (!list.length) {
      selectedId.value = null
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

const selectedConnection = computed(() => connections.value.find((connection) => connection.id === selectedId.value) ?? null)

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
}

function selectConnection(id: string) {
  selectedId.value = id
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
    <section class="connections-view__list">
      <header>
        <div>
          <h2>Connexions caméra</h2>
          <p>Ajoutez vos caméras Canon PTZ et vérifiez leur statut de connexion.</p>
        </div>
        <form class="connections-view__form" @submit.prevent="handleCreateConnection">
          <label>
            <span>Label</span>
            <input v-model="creationForm.label" type="text" required placeholder="Caméra 1" />
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
          <label>
            <span>Notes</span>
            <textarea v-model="creationForm.notes" rows="2" placeholder="Ajouter des notes"></textarea>
          </label>
          <button type="submit">Ajouter</button>
        </form>
      </header>

      <ul class="connections-view__items">
        <li v-for="connection in connections" :key="connection.id">
          <button
            type="button"
            class="connections-view__item"
            :class="{ 'connections-view__item--active': connection.id === selectedId }"
            @click="selectConnection(connection.id)"
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
    </section>

    <section v-if="selectedConnection" class="connections-view__details">
      <header class="connections-view__details-header">
        <div>
          <h3>{{ selectedConnection.label }}</h3>
          <p>Gérez les informations de connexion et lancez un test Bitfocus Companion.</p>
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
</template>

<style scoped>
.connections-view {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 1.5rem;
}

.connections-view__list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  background: rgba(10, 17, 30, 0.82);
  border: 1px solid rgba(59, 70, 88, 0.35);
  border-radius: 1.5rem;
  padding: 1.25rem;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.35);
}

.connections-view__list header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.connections-view__list h2 {
  margin: 0;
}

.connections-view__list p {
  margin: 0.35rem 0 0;
  color: rgba(148, 163, 184, 0.8);
}

.connections-view__form {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 0.75rem;
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

.connections-view__checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.connections-view__form button {
  grid-column: 1 / -1;
  justify-self: flex-start;
  border-radius: 0.9rem;
  border: 1px solid rgba(129, 140, 248, 0.55);
  background: rgba(79, 70, 229, 0.22);
  color: #eef2ff;
  padding: 0.6rem 1.2rem;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
}

.connections-view__form button:hover {
  transform: translateY(-1px);
  background: rgba(99, 102, 241, 0.32);
}

.connections-view__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
  max-height: 480px;
  overflow-y: auto;
}

.connections-view__item {
  width: 100%;
  text-align: left;
  border-radius: 1.1rem;
  border: 1px solid rgba(59, 70, 88, 0.35);
  background: rgba(15, 23, 42, 0.65);
  color: #e2e8f0;
  display: grid;
  gap: 0.65rem;
  padding: 0.85rem 1rem;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.connections-view__item--active {
  border-color: rgba(56, 189, 248, 0.65);
  box-shadow: 0 18px 40px rgba(56, 189, 248, 0.25);
}

.connections-view__item:hover {
  transform: translateY(-2px);
  border-color: rgba(129, 140, 248, 0.45);
}

.connections-view__item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.connections-view__item-label {
  font-weight: 600;
  font-size: 1.05rem;
}

.connections-view__item dl {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem 0.75rem;
  font-size: 0.85rem;
  color: rgba(148, 163, 184, 0.85);
}

.connections-view__item dt {
  font-weight: 500;
}

.connections-view__item dd {
  margin: 0;
  color: #f8fafc;
}

.connections-view__notes {
  margin: 0;
  color: rgba(148, 163, 184, 0.75);
  font-size: 0.85rem;
}

.connections-view__details {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  background: rgba(10, 17, 30, 0.82);
  border: 1px solid rgba(59, 70, 88, 0.35);
  border-radius: 1.5rem;
  padding: 1.25rem;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.35);
}

.connections-view__details-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.connections-view__details-header h3 {
  margin: 0;
}

.connections-view__details-header p {
  margin: 0.35rem 0 0;
  color: rgba(148, 163, 184, 0.8);
}

.connections-view__danger {
  border-radius: 0.9rem;
  border: 1px solid rgba(248, 113, 113, 0.55);
  background: rgba(248, 113, 113, 0.2);
  color: #fecaca;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.connections-view__danger:hover {
  border-color: rgba(248, 113, 113, 0.75);
  background: rgba(248, 113, 113, 0.3);
}

.connections-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.85rem;
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
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.connections-view__textarea {
  grid-column: 1 / -1;
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

@media (max-width: 1200px) {
  .connections-view {
    grid-template-columns: 1fr;
  }

  .connections-view__status {
    flex-direction: column;
    align-items: flex-start;
  }

  .connections-view__status-actions {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
