import type { Request, Response } from 'express'
import { Router } from 'express'
import { Readable } from 'node:stream'
import { buildCameraAuthHeaders, buildCameraUrl } from '../../lib/panasonic/client.js'
import { env } from '../../lib/env.js'
import { log } from '../../lib/logger.js'

const SNAPSHOT_PATH = '/cgi-bin/view.cgi'

function buildSnapshotUrl(req: Request): string {
  const params: Record<string, string> = { action: 'snapshot' }
  const resolution = typeof req.query.resolution === 'string' ? req.query.resolution : '0'
  if (resolution) {
    params.resolution = resolution
  }

  const vcodec = typeof req.query.vcodec === 'string' ? req.query.vcodec : ''
  if (vcodec) {
    params.vcodec = vcodec
  }

  params.n = Date.now().toString()
  return buildCameraUrl(SNAPSHOT_PATH, params)
}

async function proxySnapshot(_req: Request, res: Response) {
  const snapshotUrl = buildSnapshotUrl(_req)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort('timeout'), env.REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(snapshotUrl, {
      headers: buildCameraAuthHeaders(),
      signal: controller.signal as any,
    })

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => '')
      res
        .status(response.status || 502)
        .json({ error: errorText || 'Impossible de récupérer le flux instantané' })
      return
    }

    res.setHeader('Content-Type', response.headers.get('content-type') ?? 'image/jpeg')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Accel-Buffering', 'no')

    const nodeStream = Readable.fromWeb(response.body as any)
    nodeStream.pipe(res)
  } catch (error: any) {
    const status = error?.name === 'AbortError' ? 504 : 502
    const message = error?.message ?? 'Erreur inconnue'
    log.error({ err: error, snapshotUrl }, 'Failed to proxy snapshot')
    if (!res.headersSent) {
      res.status(status).json({ error: `Flux indisponible : ${message}` })
    }
  } finally {
    clearTimeout(timeout)
  }
}

export function createLiveStreamRouter(): Router {
  const router = Router()
  router.get('/snapshot', proxySnapshot)
  return router
}
