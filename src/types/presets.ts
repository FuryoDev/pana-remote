import type { ActionInputType } from './actions'

export interface PresetActionBinding {
  actionId: string
  inputType: ActionInputType
  notes?: string
}

export interface Preset {
  id: string
  name: string
  description: string
  actions: PresetActionBinding[]
  color?: string
}
