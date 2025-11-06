export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface ControllerConnection {
  id: string
  label: string
  address: string
  httpPort: number
  cameraModel: string
  autoConnect: boolean
  status: ConnectionStatus
  lastUpdated: string | null
  notes?: string
}
