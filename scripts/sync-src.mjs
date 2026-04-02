#!/usr/bin/env node

import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'src')

const EXCLUDED_DIRS = new Set([
  'build-src',
  'dist',
  'docs',
  'node_modules',
  'scripts',
  'src',
  'stubs',
  'vendor',
])

const SOURCE_FILE_RE = /\.(?:[cm]?[jt]sx?|d\.ts)$/
const GENERATED_STUB_RE =
  /^\/\/ Auto-generated stub(?: for.*)?\nexport default function ([A-Za-z_$][A-Za-z0-9_$]*)\(\) \{(?: return null)? ?\}\nexport const \1 = \(\) => \{(?: return null)? ?\}\n?$/m

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(full)
    } else {
      yield full
    }
  }
}

await rm(SRC, { recursive: true, force: true })
await mkdir(SRC, { recursive: true })

let copied = 0
for (const entry of await readdir(ROOT, { withFileTypes: true })) {
  if (entry.name.startsWith('.')) continue

  const from = join(ROOT, entry.name)
  const to = join(SRC, entry.name)

  if (entry.isDirectory()) {
    if (EXCLUDED_DIRS.has(entry.name)) continue
    await cp(from, to, { recursive: true })
    copied++
    continue
  }

  if (!SOURCE_FILE_RE.test(entry.name)) continue
  await cp(from, to)
  copied++
}

let normalized = 0
for await (const file of walk(SRC)) {
  if (!SOURCE_FILE_RE.test(file)) continue
  const content = await readFile(file, 'utf8')
  const match = content.match(GENERATED_STUB_RE)
  if (!match) continue
  const safeName = match[1]
  await writeFile(
    file,
    `// Auto-generated stub
const __stub = new Proxy(function ${safeName}() { return null }, {
  apply() {
    return null
  },
  get() {
    return __stub
  },
})
export default __stub
export const ${safeName} = __stub
`,
    'utf8',
  )
  normalized++
}

console.log(`Synced ${copied} top-level source entries into src/`)
console.log(`Normalized ${normalized} generated stub files in src/`)
