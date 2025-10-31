import { onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { ControlDefinition, ControlLayout, ControlWidgetInstance } from '../shared/control.js'

interface UseControlLayoutsOptions {
  cameraId: Ref<string | null>
}

interface LayoutState {
  definitions: Ref<ControlDefinition[]>
  layout: Ref<ControlLayout | null>
  isLoading: Ref<boolean>
  isSaving: Ref<boolean>
  error: Ref<string | null>
  addControl: (controlId: string) => Promise<void>
  removeControl: (widgetId: string) => Promise<void>
  reorder: (order: string[]) => Promise<void>
  refresh: () => Promise<void>
}

const COLUMN_WIDTH = 2
const COLUMN_COUNT = 4
const ROW_HEIGHT = 2

function computeGridPosition(index: number, widget: ControlWidgetInstance): ControlWidgetInstance {
  const column = index % COLUMN_COUNT
  const row = Math.floor(index / COLUMN_COUNT)
  return { ...widget, x: column * COLUMN_WIDTH, y: row * ROW_HEIGHT }
}

export function useControlLayouts({ cameraId }: UseControlLayoutsOptions): LayoutState {
  const definitions = ref<ControlDefinition[]>([])
  const layout = ref<ControlLayout | null>(null)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const error = ref<string | null>(null)
  let catalogLoaded = false

  async function loadCatalog() {
    if (catalogLoaded) {
      return
    }

    try {
      const response = await fetch('/api/control/catalog')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const payload = await response.json()
      definitions.value = Array.isArray(payload?.controls) ? payload.controls : []
      catalogLoaded = true
    } catch (err: any) {
      error.value = err?.message ?? 'Impossible de récupérer le catalogue des contrôles'
    }
  }

  async function loadLayout(currentCameraId: string | null) {
    if (!currentCameraId) {
      layout.value = null
      return
    }

    isLoading.value = true
    error.value = null
    try {
      const response = await fetch(`/api/control/layouts?cameraId=${encodeURIComponent(currentCameraId)}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      layout.value = await response.json()
    } catch (err: any) {
      error.value = err?.message ?? 'Impossible de charger la configuration de contrôle'
      layout.value = null
    } finally {
      isLoading.value = false
    }
  }

  async function persist(next: ControlLayout | null) {
    if (!next) {
      return
    }

    isSaving.value = true
    error.value = null
    try {
      const response = await fetch(`/api/control/layouts/${encodeURIComponent(next.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })

      if (!response.ok) {
        const message = await response.text().catch(() => response.statusText)
        throw new Error(message || `HTTP ${response.status}`)
      }

      layout.value = await response.json()
    } catch (err: any) {
      error.value = err?.message ?? 'Impossible de sauvegarder la configuration'
    } finally {
      isSaving.value = false
    }
  }

  function buildWidget(controlId: string): ControlWidgetInstance | null {
    const definition = definitions.value.find((item) => item.id === controlId)
    if (!definition) {
      return null
    }

    const id = crypto.randomUUID()
    const base: ControlWidgetInstance = {
      id,
      controlId,
      x: 0,
      y: 0,
      w: definition.defaultSize.w,
      h: definition.defaultSize.h,
    }

    const currentWidgets = layout.value?.widgets ?? []
    return computeGridPosition(currentWidgets.length, base)
  }

  async function addControl(controlId: string) {
    if (!layout.value) {
      return
    }

    const widget = buildWidget(controlId)
    if (!widget) {
      return
    }

    const nextLayout: ControlLayout = {
      ...layout.value,
      widgets: [...layout.value.widgets, widget],
    }

    await persist(nextLayout)
  }

  async function removeControl(widgetId: string) {
    if (!layout.value) {
      return
    }

    const filtered = layout.value.widgets.filter((item) => item.id !== widgetId)
    const reordered = filtered.map((widget, index) => computeGridPosition(index, widget))
    const nextLayout: ControlLayout = {
      ...layout.value,
      widgets: reordered,
    }

    await persist(nextLayout)
  }

  async function reorder(order: string[]) {
    if (!layout.value) {
      return
    }

    const widgetMap = new Map(layout.value.widgets.map((widget) => [widget.id, widget]))
    const sorted: ControlWidgetInstance[] = []
    for (const widgetId of order) {
      const widget = widgetMap.get(widgetId)
      if (widget) {
        sorted.push(widget)
      }
    }

    // Append any widget that might have been missing from the order array
    for (const widget of layout.value.widgets) {
      if (!order.includes(widget.id)) {
        sorted.push(widget)
      }
    }

    const repositioned = sorted.map((widget, index) => computeGridPosition(index, widget))
    const nextLayout: ControlLayout = {
      ...layout.value,
      widgets: repositioned,
    }

    await persist(nextLayout)
  }

  async function refresh() {
    await loadCatalog()
    await loadLayout(cameraId.value)
  }

  onMounted(async () => {
    await loadCatalog()
    await loadLayout(cameraId.value)
  })

  watch(cameraId, async (next) => {
    await loadLayout(next)
  })

  return {
    definitions,
    layout,
    isLoading,
    isSaving,
    error,
    addControl,
    removeControl,
    reorder,
    refresh,
  }
}
