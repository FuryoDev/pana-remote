import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { resolve } from 'node:path'
import { CONTROL_DEFINITIONS, type ControlLayout, type ControlWidgetInstance } from '../../shared/control.js'
import { log } from '../../lib/logger.js'

const DATA_DIR = resolve(process.cwd(), 'data')
const STORE_FILE = resolve(DATA_DIR, 'control-layouts.json')

const COLUMN_COUNT = 4
const COLUMN_WIDTH = 2
const ROW_HEIGHT = 2

const DEFAULT_CONTROL_ORDER: Array<{ controlId: string; w: number; h: number }> = [
  { controlId: 'ptz-up', w: 2, h: 1 },
  { controlId: 'ptz-left', w: 2, h: 1 },
  { controlId: 'ptz-stop', w: 2, h: 1 },
  { controlId: 'ptz-right', w: 2, h: 1 },
  { controlId: 'ptz-down', w: 2, h: 1 },
  { controlId: 'zoom-in', w: 2, h: 1 },
  { controlId: 'zoom-stop', w: 2, h: 1 },
  { controlId: 'zoom-out', w: 2, h: 1 },
  { controlId: 'preset-1', w: 2, h: 1 },
  { controlId: 'preset-2', w: 2, h: 1 },
  { controlId: 'preset-3', w: 2, h: 1 },
  { controlId: 'preset-4', w: 2, h: 1 },
  { controlId: 'stream-rtmp-start', w: 2, h: 1 },
  { controlId: 'stream-rtmp-stop', w: 2, h: 1 },
  { controlId: 'stream-srt-start', w: 2, h: 1 },
  { controlId: 'stream-srt-stop', w: 2, h: 1 },
  { controlId: 'color-bar-on', w: 3, h: 1 },
  { controlId: 'color-bar-off', w: 3, h: 1 },
  { controlId: 'autofocus-on', w: 3, h: 1 },
  { controlId: 'autofocus-off', w: 3, h: 1 },
]

function createDefaultWidgets(): ControlWidgetInstance[] {
  return DEFAULT_CONTROL_ORDER.map((blueprint, index) => {
    const column = index % COLUMN_COUNT
    const row = Math.floor(index / COLUMN_COUNT)
    return {
      id: randomUUID(),
      controlId: blueprint.controlId,
      x: column * COLUMN_WIDTH,
      y: row * ROW_HEIGHT,
      w: blueprint.w,
      h: blueprint.h,
    }
  })
}

function createDefaultLayout(cameraId: string): ControlLayout {
  return {
    id: `layout-${cameraId}`,
    name: `Panneau ${cameraId.toUpperCase()}`,
    cameraId,
    widgets: createDefaultWidgets(),
    updatedAt: new Date().toISOString(),
  }
}

class ControlLayoutStore {
  #layouts: ControlLayout[] = []
  #loaded = false

  async #ensureLoaded() {
    if (this.#loaded) {
      return
    }

    try {
      const raw = await fs.readFile(STORE_FILE, 'utf-8')
      const parsed = JSON.parse(raw) as ControlLayout[]
      if (Array.isArray(parsed)) {
        this.#layouts = parsed
      }
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        log.warn({ err: error }, 'Unable to read control layouts store')
      }
      await fs.mkdir(DATA_DIR, { recursive: true })
      this.#layouts = []
      await this.#persist()
    }

    this.#loaded = true
  }

  async #persist() {
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(STORE_FILE, JSON.stringify(this.#layouts, null, 2), 'utf-8')
  }

  async list(): Promise<ControlLayout[]> {
    await this.#ensureLoaded()
    return this.#layouts.map((layout) => ({ ...layout, widgets: layout.widgets.map((w) => ({ ...w })) }))
  }

  async get(id: string): Promise<ControlLayout | null> {
    await this.#ensureLoaded()
    const layout = this.#layouts.find((entry) => entry.id === id)
    return layout ? { ...layout, widgets: layout.widgets.map((w) => ({ ...w })) } : null
  }

  async getOrCreateByCamera(cameraId: string): Promise<ControlLayout> {
    await this.#ensureLoaded()
    let layout = this.#layouts.find((entry) => entry.cameraId === cameraId)
    if (!layout) {
      layout = createDefaultLayout(cameraId)
      this.#layouts.push(layout)
      await this.#persist()
    }

    return { ...layout, widgets: layout.widgets.map((w) => ({ ...w })) }
  }

  async upsert(layout: ControlLayout): Promise<ControlLayout> {
    await this.#ensureLoaded()
    const updated: ControlLayout = {
      ...layout,
      widgets: layout.widgets.map((widget) => ({ ...widget })),
      updatedAt: new Date().toISOString(),
    }

    const index = this.#layouts.findIndex((entry) => entry.id === layout.id)
    if (index >= 0) {
      this.#layouts[index] = updated
    } else {
      this.#layouts.push(updated)
    }

    await this.#persist()
    return { ...updated, widgets: updated.widgets.map((w) => ({ ...w })) }
  }

  async remove(id: string): Promise<boolean> {
    await this.#ensureLoaded()
    const initialLength = this.#layouts.length
    this.#layouts = this.#layouts.filter((entry) => entry.id !== id)
    if (this.#layouts.length !== initialLength) {
      await this.#persist()
      return true
    }

    return false
  }
}

export const controlLayoutStore = new ControlLayoutStore()

export function isKnownControl(controlId: string): boolean {
  return CONTROL_DEFINITIONS.some((definition) => definition.id === controlId)
}
