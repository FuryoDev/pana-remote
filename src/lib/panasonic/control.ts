import { env } from '../env.js'
import { PanasonicCameraClient, type PresetThumbnailPayload } from './client.js'

export type ZoomDirection = 'in' | 'out' | 'stop'
export type StreamProtocol = 'rtmp' | 'srt' | 'ts'
export type StreamCommand = 'start' | 'stop'
export type PanTiltDirection = 'up' | 'down' | 'left' | 'right' | 'stop'

export interface CameraStatus {
  uid: string
  streaming: string
}

export interface CameraInfo {
  modelName: string | null
  cameraTitle: string | null
  macAddress: string | null
  lanMacAddress: string | null
  serialNumber: string | null
  operationTime: number | null
  activationCounter: number | null
}

interface SystemInfoPayload {
  macadr?: string
  lan1_macadr?: string
  lan_macadr?: string
  serial?: string
  opetime?: number | string
  act_counter?: number | string
}

function parseKeyValuePayload(payload: string): Record<string, string> {
  return payload
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.includes('='))
    .reduce<Record<string, string>>((acc, line) => {
      const [rawKey, ...rest] = line.split('=')
      const key = rawKey?.trim()
      if (!key) {
        return acc
      }

      const value = rest.join('=').trim()
      acc[key] = value
      return acc
    }, {})
}

function parseSystemInfoPayload(payload: string): SystemInfoPayload {
  if (!payload) {
    return {}
  }

  const sanitized = payload.replace(/\r?\n/g, '')
  try {
    return JSON.parse(sanitized) as SystemInfoPayload
  } catch {
    const kv = parseKeyValuePayload(payload)
    return {
      macadr: kv.macadr,
      lan1_macadr: kv.lan1_macadr,
      lan_macadr: kv.lan_macadr,
      serial: kv.serial,
      opetime: kv.opetime,
      act_counter: kv.act_counter,
    }
  }
}

function coerceNumber(value: string | number | undefined | null): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export class PanasonicCameraService {
  constructor(private readonly client: PanasonicCameraClient) {}

  #speedOffset = 50

  #clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
  }

  #formatSpeed(value: number) {
    return this.#clamp(Math.round(value), 0, 99).toString().padStart(2, '0')
  }

  async panTilt(direction: PanTiltDirection, overrideSpeed?: number) {
    const baseSpeed = this.#clamp(
      Number.isFinite(overrideSpeed) ? Number(overrideSpeed) : env.PAN_TILT_SPEED,
      1,
      49,
    )

    if (direction === 'stop') {
      return this.client.aw_ptz('#PTS5050', '1')
    }

    let panDelta = 0
    let tiltDelta = 0

    switch (direction) {
      case 'up':
        tiltDelta = baseSpeed
        break
      case 'down':
        tiltDelta = -baseSpeed
        break
      case 'left':
        panDelta = -baseSpeed
        break
      case 'right':
        panDelta = baseSpeed
        break
      default:
        throw new Error(`Unsupported pan/tilt direction: ${direction}`)
    }

    const panSpeed = this.#formatSpeed(this.#speedOffset + panDelta)
    const tiltSpeed = this.#formatSpeed(this.#speedOffset + tiltDelta)

    return this.client.aw_ptz(`#PTS${panSpeed}${tiltSpeed}`, '1')
  }

  async zoom(direction: ZoomDirection) {
    const command = direction === 'in' ? 'Z=1' : direction === 'out' ? 'Z=2' : 'Z50'
    return this.client.aw_ptz(command, '1')
  }

  async presetRecall(presetNumber: number) {
    const formatted = String(presetNumber).padStart(2, '0')
    return this.client.aw_ptz(`R${formatted}`, '1')
  }

  async presetThumbnail(presetNumber: number): Promise<PresetThumbnailPayload> {
    if (!Number.isInteger(presetNumber) || presetNumber < 0) {
      throw new RangeError('Preset number must be a positive integer')
    }

    return this.client.getPresetThumbnail(presetNumber)
  }

  async ptzStop() {
    return this.panTilt('stop')
  }

  async colorBar(enabled: boolean) {
    return this.client.aw_cam(`DCB:${enabled ? 1 : 0}`, '1')
  }

  async autofocus(enabled: boolean) {
    return this.client.aw_cam(`OAF:${enabled ? 1 : 0}`, '1')
  }

  async stream(protocol: StreamProtocol, command: StreamCommand) {
    if (protocol === 'rtmp') return this.client.rtmpCtrl(command)
    if (protocol === 'srt') return this.client.srtCtrl(command)
    return this.client.tsCtrl(command)
  }

  async status(): Promise<CameraStatus> {
    const uid = await this.client.getUid()
    const streaming = await this.client.getStreamStat(uid)
    return { uid, streaming }
  }

  async info(): Promise<CameraInfo> {
    try {
      const [modelPayload, basicPayload, systemPayload] = await Promise.all([
        this.client.modelSerial(),
        this.client.basicInfo(),
        this.client.systemInfo(),
      ])

      const modelName = modelPayload?.split(':')[0]?.trim() ?? null

      const basic = parseKeyValuePayload(basicPayload ?? '')
      const system = parseSystemInfoPayload(systemPayload ?? '')

      const macAddress = system.macadr?.trim() ?? null
      const lanMacAddress = system.lan1_macadr?.trim() ?? system.lan_macadr?.trim() ?? null
      const serialNumber = system.serial?.trim() ?? null
      const operationTime = coerceNumber(system.opetime)
      const activationCounter = coerceNumber(system.act_counter)
      const cameraTitle = basic.cam_title?.trim() ?? null

      if (!modelName && !cameraTitle && !macAddress && !serialNumber) {
        throw new Error('Aucune donnée valide retournée par la caméra')
      }

      return {
        modelName: modelName || null,
        cameraTitle,
        macAddress,
        lanMacAddress,
        serialNumber,
        operationTime,
        activationCounter,
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Impossible de récupérer les informations de la caméra'
      throw new Error(message)
    }
  }
}
