import { ParsedCameraResponse } from '../types/camera.js'

export function parseDelimitedBody(body: string, delimiter = ':'): ParsedCameraResponse {
    const lines = body
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

    return {
        raw: body,
        lines,
        tokens: lines.map((line) => line.split(delimiter)),
    }
}