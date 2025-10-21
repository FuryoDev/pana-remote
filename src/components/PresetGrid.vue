<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

interface PresetTileState {
  loading: boolean
  objectUrl: string | null
  error: string | null
  recalling: boolean
  feedback: string | null
}

const presets = [1, 2, 3, 4, 5, 6]
const tiles = reactive<Record<number, PresetTileState>>({})
const isRefreshing = ref(false)
const cleanupTimers: Array<() => void> = []

for (const preset of presets) {
  tiles[preset] = {
    loading: true,
    objectUrl: null,
    error: null,
    recalling: false,
    feedback: null,
  }
}

async function loadThumbnail(preset: number) {
  const tile = tiles[preset]!
  tile.loading = true
  tile.error = null
  tile.feedback = null

  if (tile.objectUrl) {
    URL.revokeObjectURL(tile.objectUrl)
    tile.objectUrl = null
  }

  try {
    const response = await fetch(`/api/preset/${preset}/thumbnail`)
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.error ?? `HTTP ${response.status}`)
    }

    const blob = await response.blob()
    tile.objectUrl = URL.createObjectURL(blob)
  } catch (error: any) {
    tile.error = error?.message ?? 'Miniature indisponible'
  } finally {
    tile.loading = false
  }
}

async function refreshAll() {
  if (isRefreshing.value) {
    return
  }

  isRefreshing.value = true
  await Promise.all(presets.map((preset) => loadThumbnail(preset)))
  isRefreshing.value = false
}

async function recallPreset(preset: number) {
  const tile = tiles[preset]!
  if (tile.recalling) {
    return
  }

  tile.recalling = true
  tile.feedback = null

  try {
    const response = await fetch('/api/preset/recall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ n: preset }),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload.error ?? `HTTP ${response.status}`)
    }

    tile.feedback = 'Preset rappelé'
  } catch (error: any) {
    tile.feedback = error?.message ?? 'Commande refusée'
  } finally {
    tile.recalling = false
  }
}

function resetFeedbackTimers() {
  cleanupTimers.splice(0).forEach((dispose) => dispose())

  for (const preset of presets) {
    const tile = tiles[preset]!
    if (!tile?.feedback) {
      continue
    }

    const handle = setTimeout(() => {
      if (tiles[preset]) {
        tiles[preset]!.feedback = null
      }
    }, 2500)

    cleanupTimers.push(() => clearTimeout(handle))
  }
}

onMounted(() => {
  void refreshAll()
})

watch(
  () => presets.map((preset) => tiles[preset]?.feedback ?? null),
  () => {
    resetFeedbackTimers()
  }
)

onUnmounted(() => {
  resetFeedbackTimers()
  for (const preset of presets) {
    const tile = tiles[preset]
    if (tile?.objectUrl) {
      URL.revokeObjectURL(tile.objectUrl)
      tile.objectUrl = null
    }
  }
})

const tileEntries = computed(() => presets.map((preset) => ({ preset, state: tiles[preset]! })))
</script>

<template>
  <section class="preset-grid">
    <header>
      <h2>Presets</h2>
      <button type="button" @click="refreshAll" :disabled="isRefreshing">
        {{ isRefreshing ? 'Actualisation…' : 'Rafraîchir les miniatures' }}
      </button>
    </header>

    <div class="grid">
      <article v-for="entry in tileEntries" :key="entry.preset" class="tile">
        <header>
          <h3>Preset {{ entry.preset }}</h3>
          <button type="button" @click="recallPreset(entry.preset)" :disabled="entry.state.recalling">
            {{ entry.state.recalling ? 'Envoi…' : 'Rappeler' }}
          </button>
        </header>

        <div class="thumbnail" :class="{ loading: entry.state.loading }">
          <template v-if="entry.state.loading">
            <span>Chargement…</span>
          </template>
          <img
            v-else-if="entry.state.objectUrl"
            :src="entry.state.objectUrl"
            :alt="`Preset ${entry.preset}`"
          />
          <p v-else class="placeholder">Miniature indisponible</p>
        </div>

        <p v-if="entry.state.error" class="error">{{ entry.state.error }}</p>
        <p v-if="entry.state.feedback" class="feedback">{{ entry.state.feedback }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.preset-grid {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

h2 {
  margin: 0;
  font-size: 1.1rem;
}

button {
  appearance: none;
  border: none;
  border-radius: 9999px;
  background: #111827;
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.45rem 1.1rem;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease, background 0.2s ease;
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
}

button:disabled {
  opacity: 0.6;
  cursor: progress;
}

.grid {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.tile {
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: #f8fafc;
}

.tile > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.tile h3 {
  margin: 0;
  font-size: 1rem;
}

.tile header button {
  background: #2563eb;
}

.thumbnail {
  border-radius: 0.75rem;
  overflow: hidden;
  background: #1f2937;
  color: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
  position: relative;
}

.thumbnail.loading {
  background: repeating-linear-gradient(
    45deg,
    rgba(79, 70, 229, 0.12),
    rgba(79, 70, 229, 0.12) 10px,
    rgba(79, 70, 229, 0.22) 10px,
    rgba(79, 70, 229, 0.22) 20px
  );
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 500;
}

.error {
  margin: 0;
  font-size: 0.85rem;
  color: #b91c1c;
}

.feedback {
  margin: 0;
  font-size: 0.85rem;
  color: #0f766e;
}
</style>
