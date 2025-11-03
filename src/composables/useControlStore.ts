import { computed, type ComputedRef, type Ref } from 'vue'
import { usePersistentRef } from './usePersistentStorage'
import { createId } from '../lib/id'
import { LEGACY_ACTIONS } from '../data/legacy-actions.generated'
import type { ActionProfile, ConfiguredAction } from '../types/actions'
import type { Preset, PresetActionBinding } from '../types/presets'
import type { StreamDeckEventPayload, StreamDeckItem } from '../types/stream-deck'
import type { ActionInputType } from '../types/actions'

const DEFAULT_PRESETS: Preset[] = []
const DEFAULT_PROFILES: Record<string, ActionProfile> = {}
const DEFAULT_DECK_ITEMS: StreamDeckItem[] = []
const DEFAULT_DECK_GRID = { rows: 3, columns: 5 }

function createDefaultProfile(actionId: string): ActionProfile {
  const definition = LEGACY_ACTIONS.find((action) => action.id === actionId)
  const input: ActionInputType = definition?.supportedInputs[0] ?? 'button'
  return {
    id: actionId,
    label: definition?.name ?? actionId,
    notes: '',
    tags: [],
    defaultInput: input,
  }
}

function ensureProfiles(profiles: Record<string, ActionProfile>): Record<string, ActionProfile> {
  let changed = false
  const nextProfiles: Record<string, ActionProfile> = { ...profiles }

  for (const action of LEGACY_ACTIONS) {
    if (!nextProfiles[action.id]) {
      nextProfiles[action.id] = createDefaultProfile(action.id)
      changed = true
    }
  }

  return changed ? nextProfiles : profiles
}

interface ControlStore {
  presets: Ref<Preset[]>
  actionProfiles: Ref<Record<string, ActionProfile>>
  deckItems: Ref<StreamDeckItem[]>
  deckGrid: Ref<{ rows: number; columns: number }>
  configuredActions: ComputedRef<ConfiguredAction[]>
  createPreset(input: { name: string; description?: string; color?: string; actions?: PresetActionBinding[] }): Preset
  updatePreset(id: string, updates: Partial<Omit<Preset, 'id'>>): void
  removePreset(id: string): void
  reorderPresets(nextOrder: Preset[]): void
  updatePresetActions(id: string, actions: PresetActionBinding[]): void
  updateActionProfile(id: string, updates: Partial<Omit<ActionProfile, 'id'>>): void
  resetActionProfile(id: string): void
  setDeckItems(items: StreamDeckItem[]): void
  updateDeckItem(id: string, updates: Partial<Omit<StreamDeckItem, 'instanceId' | 'sourceId' | 'sourceType'>>): void
  removeDeckItem(id: string): void
  pushDeckEvent(event: StreamDeckEventPayload): void
  deckEvents: Ref<StreamDeckEventPayload[]>
  updateDeckGrid(updates: Partial<{ rows: number; columns: number }>): void
}

let singleton: ControlStore | null = null

function createStore(): ControlStore {
  const presets = usePersistentRef<Preset[]>('pana.presets', DEFAULT_PRESETS)
  const actionProfilesRef = usePersistentRef<Record<string, ActionProfile>>('pana.actionProfiles', DEFAULT_PROFILES)
  const deckItems = usePersistentRef<StreamDeckItem[]>('pana.deck.items', DEFAULT_DECK_ITEMS)
  const deckGrid = usePersistentRef<{ rows: number; columns: number }>('pana.deck.grid', DEFAULT_DECK_GRID)
  const deckEvents = usePersistentRef<StreamDeckEventPayload[]>('pana.deck.events', [])

  const ensuredProfiles = ensureProfiles(actionProfilesRef.value)
  if (ensuredProfiles !== actionProfilesRef.value) {
    actionProfilesRef.value = ensuredProfiles
  }

  const configuredActions = computed<ConfiguredAction[]>(() =>
    LEGACY_ACTIONS.map((definition) => {
      const profile = actionProfilesRef.value[definition.id] ?? createDefaultProfile(definition.id)
      return {
        definition,
        profile,
      }
    }).sort((a, b) => a.profile.label.localeCompare(b.profile.label, 'fr')), 
  )

  function createPreset(input: { name: string; description?: string; color?: string; actions?: PresetActionBinding[] }): Preset {
    const preset: Preset = {
      id: createId('preset'),
      name: input.name.trim(),
      description: input.description?.trim() ?? '',
      color: input.color,
      actions: input.actions ?? [],
    }
    presets.value = [...presets.value, preset]
    return preset
  }

  function updatePreset(id: string, updates: Partial<Omit<Preset, 'id'>>) {
    presets.value = presets.value.map((preset) =>
      preset.id === id ? { ...preset, ...updates, name: updates.name?.trim() ?? preset.name } : preset,
    )
  }

  function removePreset(id: string) {
    presets.value = presets.value.filter((preset) => preset.id !== id)
    deckItems.value = deckItems.value.filter((item) => !(item.sourceType === 'preset' && item.sourceId === id))
  }

  function reorderPresets(nextOrder: Preset[]) {
    presets.value = nextOrder.map((preset) => ({ ...preset, actions: [...preset.actions] }))
  }

  function updatePresetActions(id: string, actions: PresetActionBinding[]) {
    presets.value = presets.value.map((preset) => (preset.id === id ? { ...preset, actions: [...actions] } : preset))
  }

  function updateActionProfile(id: string, updates: Partial<Omit<ActionProfile, 'id'>>) {
    const current = actionProfilesRef.value[id] ?? createDefaultProfile(id)
    actionProfilesRef.value = {
      ...actionProfilesRef.value,
      [id]: { ...current, ...updates, id },
    }
  }

  function resetActionProfile(id: string) {
    const next = { ...actionProfilesRef.value }
    next[id] = createDefaultProfile(id)
    actionProfilesRef.value = next
  }

  function setDeckItems(items: StreamDeckItem[]) {
    deckItems.value = items.map((item) => ({ ...item }))
  }

  function updateDeckItem(
    id: string,
    updates: Partial<Omit<StreamDeckItem, 'instanceId' | 'sourceId' | 'sourceType'>>,
  ) {
    deckItems.value = deckItems.value.map((item) =>
      item.instanceId === id ? { ...item, ...updates } : item,
    )
  }

  function removeDeckItem(id: string) {
    deckItems.value = deckItems.value.filter((item) => item.instanceId !== id)
  }

  function pushDeckEvent(event: StreamDeckEventPayload) {
    const next = [...deckEvents.value, event]
    if (next.length > 50) {
      next.splice(0, next.length - 50)
    }
    deckEvents.value = next
  }

  function updateDeckGrid(updates: Partial<{ rows: number; columns: number }>) {
    deckGrid.value = { ...deckGrid.value, ...updates }
  }

  return {
    presets,
    actionProfiles: actionProfilesRef,
    deckItems,
    deckGrid,
    configuredActions,
    createPreset,
    updatePreset,
    removePreset,
    reorderPresets,
    updatePresetActions,
    updateActionProfile,
    resetActionProfile,
    setDeckItems,
    updateDeckItem,
    removeDeckItem,
    pushDeckEvent,
    deckEvents,
    updateDeckGrid,
  }
}

export function useControlStore(): ControlStore {
  if (singleton) {
    return singleton
  }

  singleton = createStore()
  return singleton
}
