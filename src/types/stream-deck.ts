import type { ActionInputType } from './actions'

export type StreamDeckDisplayMode = 'text' | 'icon'
export type StreamDeckActionTargetType = 'none' | 'action' | 'preset'

export interface StreamDeckButtonDisplay {
  mode: StreamDeckDisplayMode
  text?: string
  iconDataUrl?: string
}

export interface StreamDeckActionBinding {
  trigger: 'press' | 'release'
  targetType: StreamDeckActionTargetType
  targetId: string | null
}

export interface StreamDeckButton {
  instanceId: string
  pageId: string
  position: number
  inputType: ActionInputType
  display: StreamDeckButtonDisplay
  pressBinding: StreamDeckActionBinding
  releaseBinding: StreamDeckActionBinding
  accentColor?: string
}

export interface StreamDeckPage {
  id: string
  index: number
  name: string
  buttons: StreamDeckButton[]
}

export interface StreamDeckLayout {
  id: string
  name: string
  pages: StreamDeckPage[]
}

export interface StreamDeckEventPayload {
  buttonId: string
  pageId: string
  trigger: 'press' | 'release'
  targetType: StreamDeckActionTargetType
  targetId: string | null
  timestamp: string
}

export type StreamDeckButtonUpdate = Partial<
  Omit<StreamDeckButton, 'instanceId' | 'position' | 'pageId' | 'pressBinding' | 'releaseBinding' | 'display'>
> & {
  display?: Partial<StreamDeckButtonDisplay>
  pressBinding?: Partial<StreamDeckActionBinding>
  releaseBinding?: Partial<StreamDeckActionBinding>
}
