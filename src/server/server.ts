import cors from 'cors'
import express from 'express'
import { log } from '../lib/logger.js'
import { PanasonicCameraClient, PanasonicCameraService } from '../lib/panasonic/index.js'
import type { ZoomDirection } from '../lib/panasonic/control.js'

const app = express()
app.use(cors())
app.use(express.json())

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

app.get('/api/preset/:n/thumbnail', async (req, res) => {
  try {
    const preset = Number.parseInt(req.params.n ?? '', 10)

    if (!Number.isInteger(preset) || preset < 1 || preset > 100) {
      return res.status(400).json({ error: 'invalid preset number' })
    }

    const { buffer, contentType } = await service.presetThumbnail(preset)

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', buffer.length.toString())
    res.setHeader('Cache-Control', 'no-store')
    res.send(buffer)
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

const port = Number(process.env.PORT || 3000)
app.listen(port, () => log.info(`API on http://localhost:${port}`))
