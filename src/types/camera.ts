export interface CameraStatusResponse {
  uid: string
  streaming: string
  receivedAt: string
}

export type StreamProtocol = 'rtmp' | 'srt' | 'ts'
export type StreamCommand = 'start' | 'stop'

export interface CameraInfoResponse {
  modelName: string | null
  cameraTitle: string | null
  macAddress: string | null
  lanMacAddress: string | null
  serialNumber: string | null
  operationTime: number | null
  activationCounter: number | null
  receivedAt: string
}
