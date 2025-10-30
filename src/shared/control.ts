import type { PtzDirection, StreamCommand, StreamProtocol, ZoomDirection } from '../lib/panasonic/control.js'

export type ControlCategory =
  | 'PTZ Navigation'
  | 'Zoom'
  | 'Presets'
  | 'Focus'
  | 'Exposure'
  | 'Streaming'
  | 'Monitoring'
  | 'System'
  | 'Tracking'

export type ControlAvailability = 'available' | 'planned'

export type ControlAction =
  | { type: 'ptz-move'; direction: PtzDirection; speed?: number }
  | { type: 'ptz-stop' }
  | { type: 'zoom'; direction: ZoomDirection }
  | { type: 'preset-recall'; preset: number }
  | { type: 'stream-command'; protocol: StreamProtocol; command: StreamCommand }
  | { type: 'color-bar'; enabled: boolean }
  | { type: 'autofocus'; enabled: boolean }
  | { type: 'placeholder'; feature: string }

export interface ControlDefinition {
  id: string
  label: string
  description: string
  category: ControlCategory
  availability: ControlAvailability
  action: ControlAction
  defaultSize: { w: number; h: number }
}

export interface ControlWidgetInstance {
  id: string
  controlId: string
  x: number
  y: number
  w: number
  h: number
  options?: Record<string, unknown>
}

export interface ControlLayout {
  id: string
  name: string
  cameraId: string
  widgets: ControlWidgetInstance[]
  updatedAt: string
}

export const CONTROL_DEFINITIONS: ControlDefinition[] = [
  {
    id: 'ptz-up',
    label: 'Pan Haut',
    description: 'Déplace la tête PTZ vers le haut. Hérité du panneau de navigation LiveView.',
    category: 'PTZ Navigation',
    availability: 'available',
    action: { type: 'ptz-move', direction: 'up' },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'ptz-down',
    label: 'Pan Bas',
    description: 'Déplace la tête PTZ vers le bas.',
    category: 'PTZ Navigation',
    availability: 'available',
    action: { type: 'ptz-move', direction: 'down' },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'ptz-left',
    label: 'Pan Gauche',
    description: 'Déplace la caméra vers la gauche.',
    category: 'PTZ Navigation',
    availability: 'available',
    action: { type: 'ptz-move', direction: 'left' },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'ptz-right',
    label: 'Pan Droite',
    description: 'Déplace la caméra vers la droite.',
    category: 'PTZ Navigation',
    availability: 'available',
    action: { type: 'ptz-move', direction: 'right' },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'ptz-up-left',
    label: 'Pan Haut-Gauche',
    description: 'Déplacement diagonal haut/gauche.',
    category: 'PTZ Navigation',
    availability: 'available',
    action: { type: 'ptz-move', direction: 'up-left' },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'ptz-up-right',
    label: 'Pan Haut-Droite',
    description: 'Déplacement diagonal haut/droite.',
    category: 'PTZ Navigation',
    availability: 'available',
    action: { type: 'ptz-move', direction: 'up-right' },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'ptz-down-left',
    label: 'Pan Bas-Gauche',
    description: 'Déplacement diagonal bas/gauche.',
    category: 'PTZ Navigation',
    availability: 'available',
    action: { type: 'ptz-move', direction: 'down-left' },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'ptz-down-right',
    label: 'Pan Bas-Droite',
    description: 'Déplacement diagonal bas/droite.',
    category: 'PTZ Navigation',
    availability: 'available',
    action: { type: 'ptz-move', direction: 'down-right' },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'ptz-stop',
    label: 'Arrêt PTZ',
    description: 'Arrête immédiatement les mouvements PTZ.',
    category: 'PTZ Navigation',
    availability: 'available',
    action: { type: 'ptz-stop' },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'zoom-in',
    label: 'Zoom +',
    description: 'Zoom avant continu.',
    category: 'Zoom',
    availability: 'available',
    action: { type: 'zoom', direction: 'in' },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'zoom-out',
    label: 'Zoom -',
    description: 'Zoom arrière continu.',
    category: 'Zoom',
    availability: 'available',
    action: { type: 'zoom', direction: 'out' },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'zoom-stop',
    label: 'Arrêt zoom',
    description: 'Arrête le zoom en cours.',
    category: 'Zoom',
    availability: 'available',
    action: { type: 'zoom', direction: 'stop' },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'preset-1',
    label: 'Preset 1',
    description: 'Rappel du preset 1, similaire au raccourci du contrôleur legacy.',
    category: 'Presets',
    availability: 'available',
    action: { type: 'preset-recall', preset: 1 },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'preset-2',
    label: 'Preset 2',
    description: 'Rappel du preset 2.',
    category: 'Presets',
    availability: 'available',
    action: { type: 'preset-recall', preset: 2 },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'preset-3',
    label: 'Preset 3',
    description: 'Rappel du preset 3.',
    category: 'Presets',
    availability: 'available',
    action: { type: 'preset-recall', preset: 3 },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'preset-4',
    label: 'Preset 4',
    description: 'Rappel du preset 4.',
    category: 'Presets',
    availability: 'available',
    action: { type: 'preset-recall', preset: 4 },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'preset-5',
    label: 'Preset 5',
    description: 'Rappel du preset 5.',
    category: 'Presets',
    availability: 'available',
    action: { type: 'preset-recall', preset: 5 },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'preset-6',
    label: 'Preset 6',
    description: 'Rappel du preset 6.',
    category: 'Presets',
    availability: 'available',
    action: { type: 'preset-recall', preset: 6 },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'color-bar-on',
    label: 'Barres de couleur ON',
    description: 'Active le motif de barres de couleur (ancien menu « Media over IP »).',
    category: 'System',
    availability: 'available',
    action: { type: 'color-bar', enabled: true },
    defaultSize: { w: 3, h: 1 },
  },
  {
    id: 'color-bar-off',
    label: 'Barres de couleur OFF',
    description: 'Désactive le motif de barres de couleur.',
    category: 'System',
    availability: 'available',
    action: { type: 'color-bar', enabled: false },
    defaultSize: { w: 3, h: 1 },
  },
  {
    id: 'autofocus-on',
    label: 'Autofocus ON',
    description: 'Active l’autofocus (menu Camera Control du projet historique).',
    category: 'Focus',
    availability: 'available',
    action: { type: 'autofocus', enabled: true },
    defaultSize: { w: 3, h: 1 },
  },
  {
    id: 'autofocus-off',
    label: 'Autofocus OFF',
    description: 'Désactive l’autofocus.',
    category: 'Focus',
    availability: 'available',
    action: { type: 'autofocus', enabled: false },
    defaultSize: { w: 3, h: 1 },
  },
  {
    id: 'stream-rtmp-start',
    label: 'RTMP ▶',
    description: 'Démarre le stream RTMP (onglet Streaming de l’ancienne interface).',
    category: 'Streaming',
    availability: 'available',
    action: { type: 'stream-command', protocol: 'rtmp', command: 'start' },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'stream-rtmp-stop',
    label: 'RTMP ■',
    description: 'Arrête le stream RTMP.',
    category: 'Streaming',
    availability: 'available',
    action: { type: 'stream-command', protocol: 'rtmp', command: 'stop' },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'stream-srt-start',
    label: 'SRT ▶',
    description: 'Démarre le stream SRT.',
    category: 'Streaming',
    availability: 'available',
    action: { type: 'stream-command', protocol: 'srt', command: 'start' },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'stream-srt-stop',
    label: 'SRT ■',
    description: 'Arrête le stream SRT.',
    category: 'Streaming',
    availability: 'available',
    action: { type: 'stream-command', protocol: 'srt', command: 'stop' },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'stream-ts-start',
    label: 'TS ▶',
    description: 'Démarre le stream MPEG-TS.',
    category: 'Streaming',
    availability: 'available',
    action: { type: 'stream-command', protocol: 'ts', command: 'start' },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'stream-ts-stop',
    label: 'TS ■',
    description: 'Arrête le stream MPEG-TS.',
    category: 'Streaming',
    availability: 'available',
    action: { type: 'stream-command', protocol: 'ts', command: 'stop' },
    defaultSize: { w: 2, h: 1 },
  },
  {
    id: 'tracking-auto',
    label: 'Tracking auto',
    description: 'Active le suivi auto (fonctionnalité relevée dans tracking_controller.js).',
    category: 'Tracking',
    availability: 'planned',
    action: { type: 'placeholder', feature: 'auto-tracking' },
    defaultSize: { w: 3, h: 1 },
  },
  {
    id: 'tracking-manual',
    label: 'Tracking manuel',
    description: 'Prise de contrôle manuel du tracking.',
    category: 'Tracking',
    availability: 'planned',
    action: { type: 'placeholder', feature: 'manual-tracking' },
    defaultSize: { w: 3, h: 1 },
  },
  {
    id: 'exposure-iris',
    label: 'Iris avancé',
    description: 'Raccourci pour ajuster iris/gain (hérité de iris_controller.js).',
    category: 'Exposure',
    availability: 'planned',
    action: { type: 'placeholder', feature: 'iris-control' },
    defaultSize: { w: 3, h: 1 },
  },
  {
    id: 'monitor-audio',
    label: 'Vu-mètre audio',
    description: 'Affichage temps réel du niveau audio.',
    category: 'Monitoring',
    availability: 'planned',
    action: { type: 'placeholder', feature: 'audio-meter' },
    defaultSize: { w: 4, h: 2 },
  },
  {
    id: 'system-reboot',
    label: 'Redémarrage caméra',
    description: 'Déclenche le redémarrage de la caméra (section maintenance).',
    category: 'System',
    availability: 'planned',
    action: { type: 'placeholder', feature: 'reboot' },
    defaultSize: { w: 3, h: 1 },
  },
  {
    id: 'status-refresh',
    label: 'Rafraîchir statut',
    description: 'Rafraîchit les informations système.',
    category: 'Monitoring',
    availability: 'planned',
    action: { type: 'placeholder', feature: 'status-refresh' },
    defaultSize: { w: 2, h: 1 },
  },
]
