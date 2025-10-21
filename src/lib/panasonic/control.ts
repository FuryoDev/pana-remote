import { PanasonicCameraClient } from './client.js'

export type ZoomDirection = 'in' | 'out' | 'stop'
export type StreamProtocol = 'rtmp' | 'srt' | 'ts'
export type StreamCommand = 'start' | 'stop'

export interface CameraStatus {
  uid: string
  streaming: string
}

/** Formate le numéro de preset sur 2 chiffres (ex: 1 -> "01") */
function formatPresetNumber(presetNumber: number) {
  return String(presetNumber).padStart(2, '0')
}

export class CameraStatusError extends Error {
  readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'CameraStatusError'
    this.cause = cause
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class PanasonicCameraService {
  constructor(private readonly client: PanasonicCameraClient) {}

  async zoom(direction: ZoomDirection) {
    const command = direction === 'in' ? 'Z=1' : direction === 'out' ? 'Z=2' : 'Z50'
    return this.client.aw_ptz(command, '1')
  }

  async presetRecall(presetNumber: number) {
    const formatted = formatPresetNumber(presetNumber)
    return this.client.aw_ptz(`R${formatted}`, '1')
  }

  async presetThumbnail(presetNumber: number) {
    const formatted = formatPresetNumber(presetNumber)
    return this.client.getPresetThumbnail(formatted)
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
    try {
      const uid = await this.client.getUid()
      const streaming = await this.client.getStreamStat(uid)
      return { uid, streaming }
    } catch (error) {
      throw new CameraStatusError('Failed to retrieve camera status', error)
    }
  }
}
