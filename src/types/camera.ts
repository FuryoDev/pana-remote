export interface CameraStatusResponse {
  uid: string
  streaming: string
  receivedAt: string
}

export type StreamProtocol = 'rtmp' | 'srt' | 'ts'
export type StreamCommand = 'start' | 'stop'
