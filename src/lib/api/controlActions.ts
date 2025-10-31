import type { ControlAction } from '../../shared/control.js'

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText)
    throw new Error(message || `HTTP ${response.status}`)
  }

  return response
}

export async function executeControlAction(action: ControlAction) {
  switch (action.type) {
    case 'ptz-move':
      await postJson('/api/ptz/move', { direction: action.direction })
      return 'Commande PTZ envoyée'
    case 'ptz-stop':
      await postJson('/api/ptz/stop', {})
      return 'PTZ stoppé'
    case 'zoom':
      await postJson('/api/zoom', { dir: action.direction })
      return 'Zoom mis à jour'
    case 'preset-recall':
      await postJson('/api/preset/recall', { n: action.preset })
      return `Preset ${action.preset} rappelé`
    case 'stream-command':
      await postJson(`/api/stream/${action.protocol}`, { command: action.command })
      return `Stream ${action.protocol.toUpperCase()} ${action.command === 'start' ? 'démarré' : 'arrêté'}`
    case 'color-bar':
      await postJson('/api/camera/color-bar', { enabled: action.enabled })
      return action.enabled ? 'Barres de couleur activées' : 'Barres de couleur désactivées'
    case 'autofocus':
      await postJson('/api/camera/autofocus', { enabled: action.enabled })
      return action.enabled ? 'Autofocus activé' : 'Autofocus désactivé'
    case 'placeholder':
      throw new Error(`Fonctionnalité en préparation : ${action.feature}`)
    default: {
      const exhaustiveCheck: never = action
      throw new Error(`Action non supportée: ${JSON.stringify(exhaustiveCheck)}`)
    }
  }
}
