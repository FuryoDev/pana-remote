import { CommandOptions, requestThumbnail, requestWebResource, sendCamCommand, sendPtzCommand } from './commands.js'
import { ParsedCameraResponse, PresetThumbnailResponse } from '../types/camera.js'

export interface CameraControllerOptions extends CommandOptions {}

export class CameraController {
    constructor(private readonly defaults: CameraControllerOptions = {}) {}

    withOptions(overrides: CameraControllerOptions): CameraController {
        return new CameraController({ ...this.defaults, ...overrides })
    }

    async ptz(command: string, options: CameraControllerOptions = {}): Promise<ParsedCameraResponse> {
        return sendPtzCommand(command, { ...this.defaults, ...options })
    }

    async cam(command: string, options: CameraControllerOptions = {}): Promise<ParsedCameraResponse> {
        return sendCamCommand(command, { ...this.defaults, ...options })
    }

    async web(cmd: string, options: CameraControllerOptions = {}): Promise<ParsedCameraResponse> {
        return requestWebResource(cmd, { ...this.defaults, ...options })
    }

    async thumbnail(presetNumber: number, options: CameraControllerOptions = {}): Promise<PresetThumbnailResponse> {
        return requestThumbnail(presetNumber, { ...this.defaults, ...options })
    }
}