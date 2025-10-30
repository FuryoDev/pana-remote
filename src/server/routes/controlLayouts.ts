import { Router } from 'express'
import { z } from 'zod'
import {
  CONTROL_DEFINITIONS,
  type ControlLayout,
  type ControlWidgetInstance,
} from '../../shared/control.js'
import { controlLayoutStore, isKnownControl } from '../storage/controlLayoutStore.js'
import { log } from '../../lib/logger.js'

const widgetSchema = z.object({
  id: z.string().min(1),
  controlId: z.string().min(1),
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  options: z.record(z.string(), z.unknown()).optional(),
})

const layoutSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cameraId: z.string().min(1),
  widgets: z.array(widgetSchema),
  updatedAt: z.string().optional(),
})

function validateControls(widgets: ControlWidgetInstance[]): string | null {
  for (const widget of widgets) {
    if (!isKnownControl(widget.controlId)) {
      return `Unknown controlId: ${widget.controlId}`
    }
  }

  return null
}

export function createControlRouter(): Router {
  const router = Router()

  router.get('/catalog', (_req, res) => {
    res.json({ controls: CONTROL_DEFINITIONS })
  })

  router.get('/layouts', async (req, res) => {
    const cameraId = typeof req.query.cameraId === 'string' ? req.query.cameraId.trim() : ''
    if (cameraId) {
      const layout = await controlLayoutStore.getOrCreateByCamera(cameraId)
      return res.json(layout)
    }

    const layouts = await controlLayoutStore.list()
    res.json({ layouts })
  })

  router.get('/layouts/:id', async (req, res) => {
    const layout = await controlLayoutStore.get(req.params.id)
    if (!layout) {
      return res.status(404).json({ error: 'Layout not found' })
    }

    res.json(layout)
  })

  router.put('/layouts/:id', async (req, res) => {
    const parsed = layoutSchema.safeParse({ ...req.body, id: req.params.id })
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    const error = validateControls(parsed.data.widgets)
    if (error) {
      return res.status(400).json({ error })
    }

    const updated = await controlLayoutStore.upsert(parsed.data as ControlLayout)
    res.json(updated)
  })

  router.post('/layouts', async (req, res) => {
    const parsed = layoutSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    const error = validateControls(parsed.data.widgets)
    if (error) {
      return res.status(400).json({ error })
    }

    const created = await controlLayoutStore.upsert(parsed.data as ControlLayout)
    res.status(201).json(created)
  })

  router.delete('/layouts/:id', async (req, res) => {
    try {
      const removed = await controlLayoutStore.remove(req.params.id)
      if (!removed) {
        return res.status(404).json({ error: 'Layout not found' })
      }

      res.status(204).end()
    } catch (error) {
      log.error({ err: error }, 'Failed to delete layout')
      res.status(500).json({ error: 'Unable to delete layout' })
    }
  })

  return router
}
