import { camBaseUrl, env } from '../env.js'
import { log } from '../logger.js'

function buildAuthHeader(): Record<string, string> {
  if (!env.CAM_USER) {
    return {}
  }

  const token = Buffer.from(`${env.CAM_USER}:${env.CAM_PASS}`).toString('base64')
  return { Authorization: `Basic ${token}` }
}

function buildUrl(path: string, params: Record<string, string>): string {
  const url = new URL(path, camBaseUrl)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  return url.toString()
}

export class PanasonicCameraClient {
  #lastSent = 0

  private async get(path: string, params: Record<string, string>) {
    const now = Date.now()
    const delta = now - this.#lastSent

    if (delta < env.MIN_CMD_INTERVAL_MS) {
      await new Promise((resolve) => setTimeout(resolve, env.MIN_CMD_INTERVAL_MS - delta))
    }

    const url = buildUrl(path, params)
    log.debug({ url }, 'GET')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort('timeout'), env.REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        headers: buildAuthHeader(),
        signal: controller.signal as any,
      })

      const text = await response.text()
      log.debug({ status: response.status, text }, 'RES')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text}`)
      }

      return text.trim()
    } finally {
      clearTimeout(timeout)
      this.#lastSent = Date.now()
    }
  }

  private async getBinary(path: string, params: Record<string, string>) {
    const now = Date.now()
    const delta = now - this.#lastSent

    if (delta < env.MIN_CMD_INTERVAL_MS) {
      await new Promise((resolve) => setTimeout(resolve, env.MIN_CMD_INTERVAL_MS - delta))
    }

    const url = buildUrl(path, params)
    log.debug({ url }, 'GET')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort('timeout'), env.REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        headers: buildAuthHeader(),
        signal: controller.signal as any,
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        log.debug({ status: response.status, text }, 'RES')
        throw new Error(`HTTP ${response.status}: ${text}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      log.debug({ status: response.status, bytes: arrayBuffer.byteLength }, 'RES')

      return {
        data: arrayBuffer,
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      }
    } finally {
      clearTimeout(timeout)
      this.#lastSent = Date.now()
    }
  }

  aw_ptz(cmd: string, res: string = '1') {
    return this.get('/cgi-bin/aw_ptz', { cmd, res })
  }

  aw_cam(cmd: string, res: string = '1') {
    return this.get('/cgi-bin/aw_cam', { cmd, res })
  }

  rtmpCtrl(cmd: 'start' | 'stop') {
    return this.get('/cgi-bin/rtmp_ctrl', { cmd })
  }

  srtCtrl(cmd: 'start' | 'stop') {
    return this.get('/cgi-bin/srt_ctrl', { cmd })
  }

  tsCtrl(cmd: 'start' | 'stop') {
    return this.get('/cgi-bin/ts_ctrl', { cmd })
  }

  getUid() {
    return this.get('/cgi-bin/getuid', { t: Date.now().toString() })
  }

  getStreamStat(uid: string) {
    return this.get('/cgi-bin/get_streaming_status', { UID: uid })
  }

  async getPresetThumbnail(presetNumber: string) {
    const { data, contentType } = await this.getBinary('/cgi-bin/get_preset_thumbnail', {
      preset_number: presetNumber,
      t: Date.now().toString(),
    })

    return {
      buffer: Buffer.from(data),
      contentType,
    }
  }
}
