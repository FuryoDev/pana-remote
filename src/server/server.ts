import cors from 'cors'
import express from 'express'
import { log } from '../lib/logger.js'
import { PanasonicCameraClient, PanasonicCameraService } from '../lib/panasonic/index.js'
import { createLiveStreamRouter } from './routes/liveStream.js'
import { createControlRouter } from './routes/controlLayouts.js'
import type {
  PtzDirection,
  StreamCommand,
  StreamProtocol,
  ZoomDirection,
} from '../lib/panasonic/control.js'

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api/stream/live', createLiveStreamRouter())
app.use('/api/control', createControlRouter())

const service = new PanasonicCameraService(new PanasonicCameraClient())

app.post('/api/zoom', async (req, res) => {
  try {
    const direction = req.body?.dir as ZoomDirection | undefined
    if (!direction) {
      return res.status(400).json({ error: 'dir required' })
    }

    const response = await service.zoom(direction)
    res.send(response)
  } catch (error: any) {
    log.error(error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/ptz/move', async (req, res) => {
  try {
    const direction = req.body?.direction as PtzDirection | undefined
    if (!direction) {
      return res.status(400).json({ error: 'direction required' })
    }

    const allowed: PtzDirection[] = [
      'up',
      'down',
      'left',
      'right',
      'up-left',
      'up-right',
      'down-left',
      'down-right',
      'stop',
    ]

    if (!allowed.includes(direction)) {
      return res.status(400).json({ error: 'unsupported direction' })
    }

    const rawSpeed = Number(req.body?.speed)
    const speed = Number.isFinite(rawSpeed) ? rawSpeed : undefined
    const response = await service.ptzMove(direction, speed)
    res.send(response)
  } catch (error: any) {
    log.error(error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/preset/recall', async (req, res) => {
  try {
    const preset = Number(req.body?.n ?? 1)
    const response = await service.presetRecall(preset)
    res.send(response)
  } catch (error: any) {
    log.error(error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/ptz/stop', async (_req, res) => {
  try {
    const response = await service.ptzStop()
    res.send(response)
  } catch (error: any) {
    log.error(error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/camera/color-bar', async (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled)
    const response = await service.colorBar(enabled)
    res.json({ success: true, raw: response })
  } catch (error: any) {
    log.error(error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/camera/autofocus', async (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled)
    const response = await service.autofocus(enabled)
    res.json({ success: true, raw: response })
  } catch (error: any) {
    log.error(error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/camera/test-move', async (_req, res) => {
  try {
    await service.zoom('in')
    await new Promise((resolve) => setTimeout(resolve, 250))
    await service.ptzStop()

    res.json({ message: 'Commande envoyée à la caméra' })
  } catch (error: any) {
    log.error(error)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/camera/status', async (_req, res) => {
  try {
    const status = await service.status()
    res.json({ ...status, receivedAt: new Date().toISOString() })
  } catch (error: any) {
    log.error(error)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/camera/info', async (_req, res) => {
  try {
    const info = await service.info()
    res.json({ ...info, receivedAt: new Date().toISOString() })
  } catch (error: any) {
    log.error(error)
    const message =
      error instanceof Error
        ? `Impossible de récupérer les informations de la caméra : ${error.message}`
        : "Impossible de récupérer les informations de la caméra"
    res.status(502).json({ error: message })
  }
})

app.get('/api/preset/:preset/thumbnail', async (req, res) => {
  try {
    const preset = Number.parseInt(req.params.preset ?? '', 10)
    if (!Number.isFinite(preset)) {
      return res.status(400).json({ error: 'preset must be numeric' })
    }

    const { buffer, mimeType } = await service.presetThumbnail(preset)
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Cache-Control', 'no-store')
    res.send(Buffer.from(buffer))
  } catch (error: any) {
    log.error(error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/stream/:protocol', async (req, res) => {
  try {
    const protocol = req.params.protocol as StreamProtocol
    if (!['rtmp', 'srt', 'ts'].includes(protocol)) {
      return res.status(400).json({ error: 'Unsupported protocol' })
    }

    const command = req.body?.command as StreamCommand | undefined
    if (!command || !['start', 'stop'].includes(command)) {
      return res.status(400).json({ error: 'command must be "start" or "stop"' })
    }

    const response = await service.stream(protocol, command)
    res.send(response)
  } catch (error: any) {
    log.error(error)
    res.status(500).json({ error: error.message })
  }
})

const port = Number(process.env.PORT || 3000)
app.listen(port, () => log.info(`API on http://localhost:${port}`))
