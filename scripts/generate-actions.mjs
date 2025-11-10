import { promises as fs } from 'node:fs'
import path from 'node:path'

// Localise le dossier du projet indépendamment du répertoire d'exécution.
const projectRoot = path.resolve(new URL('.', import.meta.url).pathname, '..')
// Cible de génération pour la liste des actions patrimoniales.
const outputFile = path.resolve(projectRoot, 'src/data/legacy-actions.generated.ts')

const curatedActions = [
  {
    id: 'camera.motion.pan-left',
    name: 'Panoramique gauche',
    filePath: 'virtual/camera-controls/pan',
    description: "Déplace l'objectif vers la gauche à vitesse nominale.",
    group: 'Mouvement panoramique',
    supportedInputs: ['button', 'ramp'],
  },
  {
    id: 'camera.motion.pan-right',
    name: 'Panoramique droite',
    filePath: 'virtual/camera-controls/pan',
    description: "Déplace l'objectif vers la droite à vitesse nominale.",
    group: 'Mouvement panoramique',
    supportedInputs: ['button', 'ramp'],
  },
  {
    id: 'camera.motion.pan-left-slow',
    name: 'Panoramique gauche (lent)',
    filePath: 'virtual/camera-controls/pan',
    description: "Effectue un panoramique précis vers la gauche pour les plans sensibles.",
    group: 'Mouvement panoramique',
    supportedInputs: ['button', 'ramp'],
  },
  {
    id: 'camera.motion.pan-right-slow',
    name: 'Panoramique droite (lent)',
    filePath: 'virtual/camera-controls/pan',
    description: "Effectue un panoramique précis vers la droite pour les plans sensibles.",
    group: 'Mouvement panoramique',
    supportedInputs: ['button', 'ramp'],
  },
  {
    id: 'camera.motion.tilt-up',
    name: 'Inclinaison haut',
    filePath: 'virtual/camera-controls/tilt',
    description: "Fait monter l'objectif pour suivre un sujet.",
    group: 'Mouvement inclinaison',
    supportedInputs: ['button', 'ramp'],
  },
  {
    id: 'camera.motion.tilt-down',
    name: 'Inclinaison bas',
    filePath: 'virtual/camera-controls/tilt',
    description: "Fait descendre l'objectif pour recentrer le cadrage.",
    group: 'Mouvement inclinaison',
    supportedInputs: ['button', 'ramp'],
  },
  {
    id: 'camera.motion.tilt-up-slow',
    name: 'Inclinaison haut (lente)',
    filePath: 'virtual/camera-controls/tilt',
    description: "Effectue une inclinaison fine vers le haut.",
    group: 'Mouvement inclinaison',
    supportedInputs: ['button', 'ramp'],
  },
  {
    id: 'camera.motion.tilt-down-slow',
    name: 'Inclinaison bas (lente)',
    filePath: 'virtual/camera-controls/tilt',
    description: "Effectue une inclinaison fine vers le bas.",
    group: 'Mouvement inclinaison',
    supportedInputs: ['button', 'ramp'],
  },
  {
    id: 'camera.motion.zoom-in',
    name: 'Zoom avant',
    filePath: 'virtual/camera-controls/zoom',
    description: "Rapproche l'image du sujet.",
    group: 'Zoom',
    supportedInputs: ['button', 'ramp'],
  },
  {
    id: 'camera.motion.zoom-out',
    name: 'Zoom arrière',
    filePath: 'virtual/camera-controls/zoom',
    description: "Élargit le champ pour intégrer plus d'environnement.",
    group: 'Zoom',
    supportedInputs: ['button', 'ramp'],
  },
  {
    id: 'camera.motion.zoom-in-slow',
    name: 'Zoom avant (lent)',
    filePath: 'virtual/camera-controls/zoom',
    description: "Zoom progressif pour une transition douce.",
    group: 'Zoom',
    supportedInputs: ['button', 'ramp'],
  },
  {
    id: 'camera.motion.zoom-out-slow',
    name: 'Zoom arrière (lent)',
    filePath: 'virtual/camera-controls/zoom',
    description: "Zoom arrière contrôlé pour éviter les à-coups.",
    group: 'Zoom',
    supportedInputs: ['button', 'ramp'],
  },
  {
    id: 'camera.motion.focus-near',
    name: 'Mise au point proche',
    filePath: 'virtual/camera-controls/focus',
    description: "Fait converger la mise au point vers un sujet proche.",
    group: 'Focus',
    supportedInputs: ['button', 'ramp'],
  },
  {
    id: 'camera.motion.focus-far',
    name: 'Mise au point lointaine',
    filePath: 'virtual/camera-controls/focus',
    description: "Fait diverger la mise au point vers un sujet éloigné.",
    group: 'Focus',
    supportedInputs: ['button', 'ramp'],
  },
  {
    id: 'camera.motion.focus-auto',
    name: 'Basculer autofocus',
    filePath: 'virtual/camera-controls/focus',
    description: "Active ou désactive l’autofocus de la caméra.",
    group: 'Focus',
    supportedInputs: ['button'],
  },
  {
    id: 'camera.motion.home-set',
    name: 'Enregistrer position home',
    filePath: 'virtual/camera-controls/preset',
    description: "Capture la position actuelle comme référence home.",
    group: 'Positionnement',
    supportedInputs: ['button'],
  },
  {
    id: 'camera.motion.home-recall',
    name: 'Retour position home',
    filePath: 'virtual/camera-controls/preset',
    description: "Replace l’objectif sur la position home enregistrée.",
    group: 'Positionnement',
    supportedInputs: ['button'],
  },
  {
    id: 'camera.motion.move-preset-a',
    name: 'Aller au preset A',
    filePath: 'virtual/camera-controls/preset',
    description: "Déplace l’objectif vers le preset A (plan large).",
    group: 'Positionnement',
    supportedInputs: ['button'],
  },
  {
    id: 'camera.motion.move-preset-b',
    name: 'Aller au preset B',
    filePath: 'virtual/camera-controls/preset',
    description: "Déplace l’objectif vers le preset B (plan rapproché).",
    group: 'Positionnement',
    supportedInputs: ['button'],
  },
  {
    id: 'camera.motion.move-preset-c',
    name: 'Aller au preset C',
    filePath: 'virtual/camera-controls/preset',
    description: "Déplace l’objectif vers le preset C (plan speaker).",
    group: 'Positionnement',
    supportedInputs: ['button'],
  },
  {
    id: 'camera.motion.move-preset-d',
    name: 'Aller au preset D',
    filePath: 'virtual/camera-controls/preset',
    description: "Déplace l’objectif vers le preset D (plan audience).",
    group: 'Positionnement',
    supportedInputs: ['button'],
  },
]

/**
 * Transforme une liste d'actions en fichier TypeScript auto-généré.
 * Les métadonnées sont sérialisées sous forme de littéraux pour
 * faciliter la revue des diffs Git et la re-génération.
 */
function createFileContent(actions) {
  const header = "// AUTO-GENERATED FILE. Run `node scripts/generate-actions.mjs` to update.\n"
  const importLine = "import type { LegacyActionDefinition } from '../types/actions'\n\n"
  const entries = actions
    .map(
      (action) =>
        `  {\n    id: ${JSON.stringify(action.id)},\n    name: ${JSON.stringify(action.name)},\n    filePath: ${JSON.stringify(action.filePath)},\n    description: ${JSON.stringify(action.description)},\n    group: ${JSON.stringify(action.group)},\n    supportedInputs: [${action.supportedInputs.map((input) => `'${input}'`).join(', ')}],\n  }`,
    )
    .join(',\n')

  return `${header}${importLine}export const LEGACY_ACTIONS: LegacyActionDefinition[] = [\n${entries}\n]\n`
}

/**
 * Point d'entrée du script : s'assure que le dossier existe, écrit
 * le contenu généré puis affiche un message récapitulatif.
 */
async function main() {
  await fs.mkdir(path.dirname(outputFile), { recursive: true })
  const content = createFileContent(curatedActions)
  await fs.writeFile(outputFile, content)
  console.log(`Generated ${curatedActions.length} actions to ${path.relative(projectRoot, outputFile)}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
