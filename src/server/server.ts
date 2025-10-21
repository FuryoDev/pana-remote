import express from 'express'
import cors from 'cors'
import { PanasonicClient } from '../clients/panasonicClient.js'
import { CameraService } from '../services/camera-service.js'
import { log } from '../logger.js'

const app = express()
app.use(cors())
app.use(express.json())

const svc = new CameraService(new PanasonicClient())

// I1: trois endpoints
app.post('/api/zoom', async (req, res) => {
    try {
        const dir = req.body?.dir as 'in'|'out'|'stop'
        if (!dir) return res.status(400).json({ error: 'dir required' })
        const out = await svc.zoom(dir)
        res.send(out)
    } catch (e:any) {
        log.error(e); res.status(500).json({ error: e.message })
    }
})

app.post('/api/preset/recall', async (req, res) => {
    try {
        const n = Number(req.body?.n ?? 1)
        const out = await svc.presetRecall(n)
        res.send(out)
    } catch (e:any) {
        log.error(e); res.status(500).json({ error: e.message })
    }
})

app.post('/api/ptz/stop', async (_req, res) => {
    try {
        const out = await svc.ptzStop()
        res.send(out)
    } catch (e:any) {
        log.error(e); res.status(500).json({ error: e.message })
    }
})

const port = Number(process.env.PORT || 3000)
app.listen(port, () => log.info(`API on http://localhost:${port}`))
