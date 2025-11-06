import { computed, type ComputedRef, type Ref } from 'vue'
import { usePersistentRef } from './usePersistentStorage'
import { createId } from '../lib/id'
import { LEGACY_ACTIONS } from '../data/legacy-actions.generated'
import type { ActionProfile, ConfiguredAction } from '../types/actions'
import type { Preset, PresetActionBinding } from '../types/presets'
import type {
  StreamDeckButton,
  StreamDeckButtonUpdate,
  StreamDeckEventPayload,
  StreamDeckPage,
} from '../types/stream-deck'
import type { ActionInputType } from '../types/actions'
import type { ConnectionStatus, ControllerConnection } from '../types/connections'

const DEFAULT_PRESETS: Preset[] = []
const DEFAULT_PROFILES: Record<string, ActionProfile> = {}
const DEFAULT_CONNECTIONS: ControllerConnection[] = []
const DEFAULT_DECK_PAGES: StreamDeckPage[] = []

const MAX_DECK_PAGES = 99
const BUTTONS_PER_PAGE = 32

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

function createDefaultDeckButton(position: number, pageId: string): StreamDeckButton {
  return {
    instanceId: createId('deck'),
    pageId,
    position,
    inputType: 'button',
    display: {
      mode: 'text',
      text: '',
    },
    pressBinding: {
      trigger: 'press',
      targetType: 'none',
      targetId: null,
    },
    releaseBinding: {
      trigger: 'release',
      targetType: 'none',
      targetId: null,
    },
    accentColor: undefined,
  }
}

function createDeckPage(index: number): StreamDeckPage {
  const id = createId('page')
  const buttons = Array.from({ length: BUTTONS_PER_PAGE }, (_, position) =>
    createDefaultDeckButton(position, id),
  )
  return {
    id,
    index,
    name: `Page ${index}`,
    buttons,
  }
}

interface ControlStore {
  presets: Ref<Preset[]>
  actionProfiles: Ref<Record<string, ActionProfile>>
  configuredActions: ComputedRef<ConfiguredAction[]>
  createPreset(input: { name: string; description?: string; color?: string; actions?: PresetActionBinding[] }): Preset
  updatePreset(id: string, updates: Partial<Omit<Preset, 'id'>>): void
  removePreset(id: string): void
  reorderPresets(nextOrder: Preset[]): void
  updatePresetActions(id: string, actions: PresetActionBinding[]): void
  updateActionProfile(id: string, updates: Partial<Omit<ActionProfile, 'id'>>): void
  resetActionProfile(id: string): void
  connections: Ref<ControllerConnection[]>
  createConnection(input: Omit<ControllerConnection, 'id' | 'status' | 'lastUpdated'> & { status?: ConnectionStatus }): ControllerConnection
  updateConnection(id: string, updates: Partial<Omit<ControllerConnection, 'id'>>): void
  removeConnection(id: string): void
  updateConnectionStatus(id: string, status: ConnectionStatus): void
  deckPages: Ref<StreamDeckPage[]>
  activeDeckPageId: Ref<string | null>
  activeDeckPage: ComputedRef<StreamDeckPage | null>
  setActiveDeckPage(pageId: string): void
  addDeckPage(): StreamDeckPage | null
  updateDeckPage(pageId: string, updates: Partial<Pick<StreamDeckPage, 'name' | 'index'>>): void
  removeDeckPage(pageId: string): void
  updateDeckButton(pageId: string, buttonId: string, updates: StreamDeckButtonUpdate): void
  resetDeckButton(pageId: string, buttonId: string): void
  deckEvents: Ref<StreamDeckEventPayload[]>
  pushDeckEvent(event: StreamDeckEventPayload): void
}

let singleton: ControlStore | null = null

function createStore(): ControlStore {
  const presets = usePersistentRef<Preset[]>('pana.presets', DEFAULT_PRESETS)
  const actionProfilesRef = usePersistentRef<Record<string, ActionProfile>>('pana.actionProfiles', DEFAULT_PROFILES)
  const connections = usePersistentRef<ControllerConnection[]>('pana.connections', DEFAULT_CONNECTIONS)
  const deckPagesRef = usePersistentRef<StreamDeckPage[]>('pana.deck.pages', DEFAULT_DECK_PAGES)
  const activeDeckPageIdRef = usePersistentRef<string | null>('pana.deck.activePage', null)
  const deckEvents = usePersistentRef<StreamDeckEventPayload[]>('pana.deck.events', [])

  const ensuredProfiles = ensureProfiles(actionProfilesRef.value)
  if (ensuredProfiles !== actionProfilesRef.value) {
    actionProfilesRef.value = ensuredProfiles
  }

  if (!deckPagesRef.value.length) {
    const firstPage = createDeckPage(1)
    deckPagesRef.value = [firstPage]
    activeDeckPageIdRef.value = firstPage.id
  } else {
    deckPagesRef.value = deckPagesRef.value.map((page, pageIndex) => ({
      ...page,
      index: page.index ?? pageIndex + 1,
      buttons: page.buttons.map((button, positionIndex) => ({
        ...createDefaultDeckButton(positionIndex, page.id),
        ...button,
        pageId: page.id,
        position: button.position ?? positionIndex,
        display: {
          ...createDefaultDeckButton(positionIndex, page.id).display,
          ...button.display,
        },
        pressBinding: {
          ...createDefaultDeckButton(positionIndex, page.id).pressBinding,
          ...button.pressBinding,
        },
        releaseBinding: {
          ...createDefaultDeckButton(positionIndex, page.id).releaseBinding,
          ...button.releaseBinding,
        },
      })),
    }))
    if (!activeDeckPageIdRef.value || !deckPagesRef.value.some((page) => page.id === activeDeckPageIdRef.value)) {
      activeDeckPageIdRef.value = deckPagesRef.value[0]?.id ?? null
    }
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
    deckPagesRef.value = deckPagesRef.value.map((page) => ({
      ...page,
      buttons: page.buttons.map((button) => {
        const update: StreamDeckButtonUpdate = {}
        const press = button.pressBinding
        if (press.targetType === 'preset' && press.targetId === id) {
          update.pressBinding = { targetType: 'none', targetId: null }
        }
        const release = button.releaseBinding
        if (release.targetType === 'preset' && release.targetId === id) {
          update.releaseBinding = { targetType: 'none', targetId: null }
        }
        if (!Object.keys(update).length) {
          return button
        }
        return {
          ...button,
          pressBinding: update.pressBinding ? { ...button.pressBinding, ...update.pressBinding } : button.pressBinding,
          releaseBinding: update.releaseBinding
            ? { ...button.releaseBinding, ...update.releaseBinding }
            : button.releaseBinding,
        }
      }),
    }))
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

  function createConnection(
    input: Omit<ControllerConnection, 'id' | 'status' | 'lastUpdated'> & { status?: ConnectionStatus },
  ): ControllerConnection {
    const connection: ControllerConnection = {
      id: createId('connection'),
      label: input.label.trim(),
      address: input.address.trim(),
      httpPort: input.httpPort,
      cameraModel: input.cameraModel,
      autoConnect: input.autoConnect,
      notes: input.notes?.trim() || undefined,
      status: input.status ?? 'disconnected',
      lastUpdated: null,
    }
    connections.value = [...connections.value, connection]
    return connection
  }

  function updateConnection(id: string, updates: Partial<Omit<ControllerConnection, 'id'>>) {
    connections.value = connections.value.map((connection) =>
      connection.id === id
        ? {
            ...connection,
            ...updates,
            label: updates.label?.trim() ?? connection.label,
            address: updates.address?.trim() ?? connection.address,
            notes: updates.notes?.trim() ?? connection.notes,
          }
        : connection,
    )
  }

  function removeConnection(id: string) {
    connections.value = connections.value.filter((connection) => connection.id !== id)
  }

  function updateConnectionStatus(id: string, status: ConnectionStatus) {
    const timestamp = new Date().toISOString()
    connections.value = connections.value.map((connection) =>
      connection.id === id
        ? {
            ...connection,
            status,
            lastUpdated: timestamp,
          }
        : connection,
    )
  }

  const activeDeckPage = computed<StreamDeckPage | null>(() => {
    if (!deckPagesRef.value.length) {
      return null
    }
    const activeId = activeDeckPageIdRef.value
    const sorted = [...deckPagesRef.value].sort((a, b) => a.index - b.index)
    if (!activeId) {
      return sorted[0] ?? null
    }
    return sorted.find((page) => page.id === activeId) ?? sorted[0] ?? null
  })

  function setActiveDeckPage(pageId: string) {
    if (deckPagesRef.value.some((page) => page.id === pageId)) {
      activeDeckPageIdRef.value = pageId
    }
  }

  function addDeckPage(): StreamDeckPage | null {
    if (deckPagesRef.value.length >= MAX_DECK_PAGES) {
      return null
    }
    const nextIndex = deckPagesRef.value.length + 1
    const page = createDeckPage(nextIndex)
    deckPagesRef.value = [...deckPagesRef.value, page]
    activeDeckPageIdRef.value = page.id
    return page
  }

  function updateDeckPage(pageId: string, updates: Partial<Pick<StreamDeckPage, 'name' | 'index'>>) {
    deckPagesRef.value = deckPagesRef.value.map((page) =>
      page.id === pageId
        ? {
            ...page,
            ...updates,
            name: updates.name?.trim() ?? page.name,
            index: updates.index ?? page.index,
          }
        : page,
    )
    const sorted = [...deckPagesRef.value].sort((a, b) => a.index - b.index)
    deckPagesRef.value = sorted.map((page, idx) => ({ ...page, index: idx + 1 }))
  }

  function removeDeckPage(pageId: string) {
    if (deckPagesRef.value.length <= 1) {
      return
    }
    deckPagesRef.value = deckPagesRef.value.filter((page) => page.id !== pageId)
    deckPagesRef.value = deckPagesRef.value
      .sort((a, b) => a.index - b.index)
      .map((page, idx) => ({ ...page, index: idx + 1 }))
    if (!deckPagesRef.value.some((page) => page.id === activeDeckPageIdRef.value)) {
      activeDeckPageIdRef.value = deckPagesRef.value[0]?.id ?? null
    }
  }

  function updateDeckButton(pageId: string, buttonId: string, updates: StreamDeckButtonUpdate) {
    deckPagesRef.value = deckPagesRef.value.map((page) => {
      if (page.id !== pageId) {
        return page
      }
      return {
        ...page,
        buttons: page.buttons.map((button) => {
          if (button.instanceId !== buttonId) {
            return button
          }
          const nextDisplay = updates.display
            ? { ...button.display, ...updates.display }
            : button.display
          const nextPress = updates.pressBinding
            ? { ...button.pressBinding, ...updates.pressBinding }
            : button.pressBinding
          const nextRelease = updates.releaseBinding
            ? { ...button.releaseBinding, ...updates.releaseBinding }
            : button.releaseBinding
          return {
            ...button,
            ...updates,
            display: nextDisplay,
            pressBinding: nextPress,
            releaseBinding: nextRelease,
          }
        }),
      }
    })
  }

  function resetDeckButton(pageId: string, buttonId: string) {
    deckPagesRef.value = deckPagesRef.value.map((page) => {
      if (page.id !== pageId) {
        return page
      }
      return {
        ...page,
        buttons: page.buttons.map((button, index) => {
          if (button.instanceId !== buttonId) {
            return button
          }
          const base = createDefaultDeckButton(index, page.id)
          return {
            ...base,
            instanceId: button.instanceId,
            pageId: page.id,
            position: button.position,
          }
        }),
      }
    })
  }

  function pushDeckEvent(event: StreamDeckEventPayload) {
    const next = [...deckEvents.value, event]
    if (next.length > 50) {
      next.splice(0, next.length - 50)
    }
    deckEvents.value = next
  }

  return {
    presets,
    actionProfiles: actionProfilesRef,
    configuredActions,
    createPreset,
    updatePreset,
    removePreset,
    reorderPresets,
    updatePresetActions,
    updateActionProfile,
    resetActionProfile,
    connections,
    createConnection,
    updateConnection,
    removeConnection,
    updateConnectionStatus,
    deckPages: deckPagesRef,
    activeDeckPageId: activeDeckPageIdRef,
    activeDeckPage,
    setActiveDeckPage,
    addDeckPage,
    updateDeckPage,
    removeDeckPage,
    updateDeckButton,
    resetDeckButton,
    deckEvents,
    pushDeckEvent,
  }
}

export function useControlStore(): ControlStore {
  if (singleton) {
    return singleton
  }

  singleton = createStore()
  return singleton
}
