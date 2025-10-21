import { cameraRequest, CameraRequestOptions } from '../http/cameraHttpClient.js'
import { parseDelimitedBody } from './parse.js'
import { ParsedCameraResponse, PresetThumbnailResponse } from '../types/camera.js'

const PTZ_COMMAND_PATTERN = /^[A-Z0-9:]+$/i
const CAM_COMMAND_PATTERN = /^[A-Z0-9:]+$/i

export interface CommandOptions extends Omit<CameraRequestOptions, 'searchParams' | 'method' | 'body' | 'responseType'> {}

export async function sendPtzCommand(command: string, options: CommandOptions = {}): Promise<ParsedCameraResponse> {
    const normalized = normalizeCommand(command, PTZ_COMMAND_PATTERN, 'PTZ')
    const response = await cameraRequest('/cgi-bin/aw_ptz', {
        ...options,
        searchParams: {
            cmd: `#${normalized}`,
            res: '1',
        },
    })

    return parseDelimitedBody(response.body)
}

export async function sendCamCommand(command: string, options: CommandOptions = {}): Promise<ParsedCameraResponse> {
    const normalized = normalizeCommand(command, CAM_COMMAND_PATTERN, 'CAM')
    const response = await cameraRequest('/cgi-bin/aw_cam', {
        ...options,
        searchParams: {
            cmd: normalized,
            res: '1',
        },
    })

    return parseDelimitedBody(response.body)
}

export async function requestWebResource(cmd: string, options: CommandOptions = {}): Promise<ParsedCameraResponse> {
    const sanitized = cmd.replace(/^\/+/, '')
    const response = await cameraRequest(`/cgi-bin/${sanitized}`, options)
    return parseDelimitedBody(response.body, '=')
}

export async function requestThumbnail(presetNumber: number, options: CommandOptions = {}): Promise<PresetThumbnailResponse> {
    if (!Number.isInteger(presetNumber) || presetNumber < 0) {
        throw new RangeError('Preset number must be a positive integer')
    }

    const response = await cameraRequest<ArrayBuffer>('/cgi-bin/get_preset_thumbnail', {
        ...options,
        responseType: 'arrayBuffer',
        searchParams: {
            preset_number: presetNumber,
        },
    })

    return {
        raw: response.body,
        mimeType: response.headers.get('content-type') || 'application/octet-stream',
    }
}

function normalizeCommand(command: string, pattern: RegExp, label: string): string {
    const value = command.trim().toUpperCase()
    if (value.length === 0) {
        throw new Error(`${label} command must not be empty`)
    }

    if (!pattern.test(value)) {
        throw new Error(`${label} command contains unexpected characters: "${command}"`)
    }

    return value
}