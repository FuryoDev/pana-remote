export type PanTiltDirection = 'stop' | 'up' | 'down' | 'left' | 'right'
export type PanTiltMoveDirection = Exclude<PanTiltDirection, 'stop'>
