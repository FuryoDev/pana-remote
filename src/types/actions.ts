export type ActionInputType = 'button' | 'ramp'

export interface LegacyActionDefinition {
  id: string
  name: string
  filePath: string
  description?: string
  group?: string
  supportedInputs: ActionInputType[]
}

export interface ActionProfile {
  id: string
  label: string
  notes?: string
  tags: string[]
  defaultInput: ActionInputType
}

export interface ConfiguredAction {
  definition: LegacyActionDefinition
  profile: ActionProfile
}
