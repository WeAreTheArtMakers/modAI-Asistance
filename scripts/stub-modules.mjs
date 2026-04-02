#!/usr/bin/env node
/**
 * stub-modules.mjs — Create stub files for all missing feature-gated modules
 *
 * Run: node scripts/stub-modules.mjs
 * Then: npx esbuild build-src/entry.ts --bundle --platform=node --packages=external ...
 *
 * Reads esbuild errors, resolves each relative import to its correct absolute
 * path inside build-src/src/, and creates an empty stub.
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = join(import.meta.dirname, '..')
const BUILD_SRC = join(ROOT, 'build-src', 'src')

async function exists(p) { try { await stat(p); return true } catch { return false } }

function getSafeName(mod) {
  const name = mod.split('/').pop()?.replace(/\.[tj]sx?$/, '') || 'stub'
  return name.replace(/[^a-zA-Z0-9_$]/g, '_') || 'stub'
}

function collectExportNames(importerSource, mod) {
  const escaped = mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const names = new Set()
  const namedImportRe = new RegExp(
    `(?:import|export)\\s*\\{([^}]*)\\}\\s*from\\s*['"]${escaped}['"]`,
    'g',
  )
  let match
  while ((match = namedImportRe.exec(importerSource)) !== null) {
    const raw = match[1] || ''
    for (const part of raw.split(',')) {
      const cleaned = part
        .replace(/\btype\b/g, '')
        .trim()
      if (!cleaned) continue
      const exportedName = cleaned.split(/\s+as\s+/i)[0]?.trim()
      if (exportedName && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(exportedName)) {
        names.add(exportedName)
      }
    }
  }
  return [...names]
}

function renderStubModule(mod, exportNames = []) {
  const safeName = getSafeName(mod)
  const namedExports = exportNames
    .filter(name => name !== 'default')
    .map(name => `export const ${name} = __stub`)
    .join('\n')

  return `// Auto-generated stub for feature-gated module: ${mod}
const __stub = new Proxy(function ${safeName}() { return null }, {
  apply() {
    return null
  },
  get() {
    return __stub
  },
})
export default __stub
${namedExports}
`
}

function collectMissingImporters(esbuildOutput) {
  const moduleImporters = new Map()
  const blocks = esbuildOutput.split('✘ [ERROR] ').slice(1)

  for (const block of blocks) {
    const modMatch = block.match(/^Could not resolve "([^"]+)"/m)
    const importerMatch = block.match(/^\s+([^\n:]+):\d+:\d+:/m)
    if (!modMatch || !importerMatch) continue

    const mod = modMatch[1]
    if (!mod || mod.startsWith('node:') || mod.startsWith('bun:') || mod.startsWith('/')) {
      continue
    }

    const importerRel = importerMatch[1]
    const importer = importerRel.startsWith('build-src/')
      ? join(ROOT, importerRel)
      : join(ROOT, 'build-src', importerRel)
    if (!moduleImporters.has(mod)) moduleImporters.set(mod, new Set())
    moduleImporters.get(mod).add(importer)
  }

  return moduleImporters
}

// Parse all missing modules from esbuild output
const out = execSync(
  `npx esbuild "${join(ROOT, 'build-src', 'entry.ts')}" ` +
  `--bundle --platform=node --alias:src=./build-src/src --packages=external ` +
  `--external:'bun:*' --log-level=error --log-limit=0 ` +
  `--loader:.md=text --loader:.txt=text ` +
  `--outfile=/dev/null 2>&1 || true`,
  { cwd: ROOT, shell: true, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
)

const moduleFiles = collectMissingImporters(out)

let stubCount = 0
const created = new Set()

for (const [mod, importersSet] of moduleFiles) {
  // For relative imports, we need to find the importing file to resolve the path
  // Search for the import in the build-src
  const importers = [...importersSet]

  for (const importer of importers) {
    const importerDir = dirname(importer)
    const absPath = resolve(importerDir, mod)

    // Check if it's a .d.ts type file — just create empty
    if (mod.endsWith('.d.ts')) {
      if (!created.has(absPath)) {
        await mkdir(dirname(absPath), { recursive: true }).catch(() => {})
        if (!await exists(absPath)) {
          await writeFile(absPath, '// Type stub\nexport {}\n', 'utf8')
          stubCount++
          created.add(absPath)
        }
      }
      continue
    }

    // Text assets (.txt, .md)
    if (/\.(txt|md)$/.test(mod)) {
      if (!created.has(absPath)) {
        await mkdir(dirname(absPath), { recursive: true }).catch(() => {})
        if (!await exists(absPath)) {
          await writeFile(absPath, '', 'utf8')
          stubCount++
          created.add(absPath)
        }
      }
      continue
    }

    // JS/TS modules
    if (/\.[tj]sx?$/.test(mod)) {
      if (!created.has(absPath)) {
        await mkdir(dirname(absPath), { recursive: true }).catch(() => {})
        if (!await exists(absPath)) {
          const importerSource = await readFile(importer, 'utf8').catch(() => '')
          const exportNames = collectExportNames(importerSource, mod)
          await writeFile(absPath, renderStubModule(mod, exportNames), 'utf8')
          stubCount++
          created.add(absPath)
        }
      }
    }
  }

  // Also try resolving from src root for modules starting with ../
  if (mod.startsWith('../')) {
    // Try from several likely locations
    for (const prefix of ['src', 'src/commands', 'src/components', 'src/services', 'src/tools', 'src/utils']) {
      const absPath = join(ROOT, 'build-src', prefix, mod)
      if (!created.has(absPath)) {
        await mkdir(dirname(absPath), { recursive: true }).catch(() => {})
        if (!await exists(absPath) && (/\.[tj]sx?$/.test(mod))) {
          await writeFile(absPath, renderStubModule(mod), 'utf8')
          stubCount++
          created.add(absPath)
        }
      }
    }
  }
}

console.log(`✅ Created ${stubCount} stubs for ${moduleFiles.size} missing modules`)

// Now try the build
console.log('\n🔨 Attempting esbuild bundle...\n')
try {
  const OUT = join(ROOT, 'dist', 'cli.js')
  await mkdir(dirname(OUT), { recursive: true })

  execSync([
    'npx esbuild',
    `"${join(ROOT, 'build-src', 'entry.ts')}"`,
    '--bundle',
    '--platform=node',
    '--target=node18',
    '--format=esm',
    `--outfile="${OUT}"`,
    '--alias:src=./build-src/src',
    '--packages=external',
    '--loader:.md=text',
    '--loader:.txt=text',
    '--external:bun:*',
    '--banner:js=$\'#!/usr/bin/env node\\n// Claude Code v2.1.88 (built from source)\\n// Copyright (c) Anthropic PBC. All rights reserved.\\n\'',
    '--allow-overwrite',
    '--log-level=warning',
    '--sourcemap',
  ].join(' '), {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  })

  const size = (await stat(OUT)).size
  console.log(`\n✅ Build succeeded: ${OUT}`)
  console.log(`   Size: ${(size / 1024 / 1024).toFixed(1)}MB`)
  console.log(`   Usage: node ${OUT} --version`)
} catch (e) {
  console.error('\n❌ Build still has errors. Run again to iterate:')
  console.error('   node scripts/stub-modules.mjs')
}
