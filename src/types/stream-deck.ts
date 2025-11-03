import type { ActionInputType } from './actions'

export type StreamDeckSourceType = 'preset' | 'action'

export interface StreamDeckItem {
  instanceId: string
  sourceType: StreamDeckSourceType
  sourceId: string
  inputType: ActionInputType
  customLabel?: string
  accentColor?: string
}

export interface StreamDeckLayout {
  rows: number
  columns: number
  items: StreamDeckItem[]
}

export interface StreamDeckEventPayload {
  instanceId: string
  sourceType: StreamDeckSourceType
  sourceId: string
  inputType: ActionInputType
  value?: number
  timestamp: string
}
