import { PanasonicCameraClient, type PresetThumbnailPayload } from './client.js'

const SPEED_OFFSET = 50
const MOVE_SPEED = 20

function formatSpeed(value: number): string {
  const clamped = Math.max(0, Math.min(99, Math.round(value)))
  return clamped.toString().padStart(2, '0')
}

const PAN_TILT_COMMANDS: Record<PanTiltDirection, string> = {
  stop: '#PTS5050',
  up: `#PTS${formatSpeed(SPEED_OFFSET)}${formatSpeed(SPEED_OFFSET + MOVE_SPEED)}`,
  down: `#PTS${formatSpeed(SPEED_OFFSET)}${formatSpeed(SPEED_OFFSET - MOVE_SPEED)}`,
  left: `#PTS${formatSpeed(SPEED_OFFSET - MOVE_SPEED)}${formatSpeed(SPEED_OFFSET)}`,
  right: `#PTS${formatSpeed(SPEED_OFFSET + MOVE_SPEED)}${formatSpeed(SPEED_OFFSET)}`,
}

export type ZoomDirection = 'in' | 'out' | 'stop'
export type StreamProtocol = 'rtmp' | 'srt' | 'ts'
export type StreamCommand = 'start' | 'stop'
export type PanTiltDirection = 'stop' | 'up' | 'down' | 'left' | 'right'

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

  async panTilt(direction: PanTiltDirection) {
    const command = PAN_TILT_COMMANDS[direction]
    if (!command) {
      throw new Error(`Unsupported direction: ${direction}`)
    }

    return this.client.aw_ptz(command, '1')
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
    return this.client.aw_ptz('#PTS', '1')
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
