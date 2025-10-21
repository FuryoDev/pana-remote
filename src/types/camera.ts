export interface ParsedCameraResponse {
    /** Raw response body returned by the camera */
    raw: string
    /** Individual non-empty lines in the response */
    lines: string[]
    /** Each response line split on ':' delimiters */
    tokens: string[][]
}

export interface PresetThumbnailResponse {
    raw: ArrayBuffer
    mimeType: string
}