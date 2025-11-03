import { promises as fs } from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(new URL('.', import.meta.url).pathname, '..')

const legacyFolders = [
  path.resolve(projectRoot, 'old projects/pana-other/10.41.39.153/js/pc'),
  path.resolve(projectRoot, 'old projects/pana-other/10.41.39.153/js/include'),
]

const outputFile = path.resolve(projectRoot, 'src/data/legacy-actions.generated.ts')

const functionRegex = /function\s+([a-zA-Z0-9_]+)\s*\(/g
const assignmentRegex = /(const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*function\s*\(/g

function toTitleCase(value) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
}

async function readFunctions(filePath) {
  const content = await fs.readFile(filePath, 'utf8')
  const functions = new Set()

  for (const regex of [functionRegex, assignmentRegex]) {
    regex.lastIndex = 0
    let match
    while ((match = regex.exec(content)) !== null) {
      const name = match[1] ?? match[2]
      if (!name) continue
      if (name === 'constructor') continue
      functions.add(name)
    }
  }

  return Array.from(functions)
}

async function collectActions() {
  const actions = []
  for (const folder of legacyFolders) {
    const entries = await fs.readdir(folder, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.js')) {
        continue
      }
      const filePath = path.join(folder, entry.name)
      const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/')
      const baseName = entry.name.replace(/\.js$/, '')
      const functions = await readFunctions(filePath)
      if (functions.length === 0) {
        actions.push({
          id: `${relativePath}::default`,
          name: toTitleCase(baseName),
          filePath: relativePath,
          group: folder.includes('/pc') ? 'pc' : 'include',
        })
        continue
      }

      for (const fn of functions) {
        actions.push({
          id: `${relativePath}::${fn}`,
          name: toTitleCase(fn),
          filePath: relativePath,
          group: folder.includes('/pc') ? 'pc' : 'include',
        })
      }
    }
  }

  const sorted = actions.sort((a, b) => a.name.localeCompare(b.name))
  return sorted
}

function createFileContent(actions) {
  const header = `// AUTO-GENERATED FILE. Run \`node scripts/generate-actions.mjs\` to update.\n`
  const importLine = "import type { LegacyActionDefinition } from '../types/actions'\n\n"
  const entries = actions
    .map((action) => ({
      ...action,
      supportedInputs: ['button'],
    }))
    .map(
      (action) =>
        `  {\n    id: ${JSON.stringify(action.id)},\n    name: ${JSON.stringify(action.name)},\n    filePath: ${JSON.stringify(action.filePath)},\n    group: ${JSON.stringify(action.group)},\n    supportedInputs: ['button'],\n  }`,
    )
    .join(',\n')

  return `${header}${importLine}export const LEGACY_ACTIONS: LegacyActionDefinition[] = [\n${entries}\n]\n`
}

async function main() {
  const actions = await collectActions()
  await fs.mkdir(path.dirname(outputFile), { recursive: true })
  const content = createFileContent(actions)
  await fs.writeFile(outputFile, content)
  console.log(`Generated ${actions.length} actions to ${path.relative(projectRoot, outputFile)}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
