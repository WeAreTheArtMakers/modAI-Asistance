#!/usr/bin/env node
/**
 * build.mjs — Best-effort build of Claude Code v2.1.88 from source
 *
 * ⚠️  IMPORTANT: A complete rebuild requires the Bun runtime's compile-time
 *     intrinsics (feature(), MACRO, bun:bundle). This script provides a
 *     best-effort build using esbuild. See KNOWN_ISSUES.md for details.
 *
 * What this script does:
 *   1. Copy src/ → build-src/ (original untouched)
 *   2. Replace `feature('X')` → `false`  (compile-time → runtime)
 *   3. Replace `MACRO.VERSION` etc → string literals
 *   4. Replace `import from 'bun:bundle'` → stub
 *   5. Create stubs for missing feature-gated modules
 *   6. Bundle with esbuild → dist/cli.js
 *
 * Requirements: Node.js >= 18, npm
 * Usage:       node scripts/build.mjs
 */

import { readdir, readFile, writeFile, mkdir, cp, rm, stat } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const VERSION = '2.1.88'
const BUILD = join(ROOT, 'build-src')
const ENTRY = join(BUILD, 'entry.ts')

// ── Helpers ────────────────────────────────────────────────────────────────

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory() && e.name !== 'node_modules') yield* walk(p)
    else yield p
  }
}

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
      : join(BUILD, importerRel)
    if (!moduleImporters.has(mod)) moduleImporters.set(mod, new Set())
    moduleImporters.get(mod).add(importer)
  }

  return moduleImporters
}

async function ensureEsbuild() {
  try { execSync('npx esbuild --version', { stdio: 'pipe' }) }
  catch {
    console.log('📦 Installing esbuild...')
    execSync('npm install --save-dev esbuild', { cwd: ROOT, stdio: 'inherit' })
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1: Copy source
// ══════════════════════════════════════════════════════════════════════════════

await rm(BUILD, { recursive: true, force: true })
await mkdir(BUILD, { recursive: true })
await cp(join(ROOT, 'src'), join(BUILD, 'src'), { recursive: true })
console.log('✅ Phase 1: Copied src/ → build-src/')

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2: Transform source
// ══════════════════════════════════════════════════════════════════════════════

let transformCount = 0

// MACRO replacements
const MACROS = [
  ['MACRO.VERSION_CHANGELOG', `''`],
  ['MACRO.FEEDBACK_CHANNEL_URL', `'https://github.com/anthropics/claude-code/issues'`],
  ['MACRO.ISSUES_EXPLAINER_URL', `'https://github.com/anthropics/claude-code/issues/new/choose'`],
  ['MACRO.NATIVE_PACKAGE_URL', `'@anthropic-ai/claude-code'`],
  ['MACRO.FEEDBACK_CHANNEL', `'https://github.com/anthropics/claude-code/issues'`],
  ['MACRO.ISSUES_EXPLAINER', `'https://github.com/anthropics/claude-code/issues/new/choose'`],
  ['MACRO.PACKAGE_URL', `'@anthropic-ai/claude-code'`],
  ['MACRO.BUILD_TIME', `''`],
  ['MACRO.VERSION', `'${VERSION}'`],
]

for await (const file of walk(join(BUILD, 'src'))) {
  if (!file.match(/\.[tj]sx?$/)) continue

  let src = await readFile(file, 'utf8')
  let changed = false

  // 2a. feature('X') → false
  if (/\bfeature\s*\(\s*['"][^'"]+['"]\s*,?\s*\)/.test(src)) {
    src = src.replace(/\bfeature\s*\(\s*['"][^'"]+['"]\s*,?\s*\)/g, 'false')
    changed = true
  }

  // 2b. MACRO.X → literals
  for (const [k, v] of MACROS) {
    if (src.includes(k)) {
      src = src.replaceAll(k, v)
      changed = true
    }
  }

  // 2c. Remove bun:bundle import (feature() is already replaced)
  if (src.includes("from 'bun:bundle'") || src.includes('from "bun:bundle"')) {
    src = src.replace(/import\s*\{\s*feature\s*\}\s*from\s*['"]bun:bundle['"];?\n?/g, '// feature() replaced with false at build time\n')
    changed = true
  }

  // 2d. Remove type-only import of global.d.ts
  if (src.includes("import '../global.d.ts'") || src.includes("import './global.d.ts'")) {
    src = src.replace(/import\s*['"][.\/]*global\.d\.ts['"];?\n?/g, '')
    changed = true
  }

  if (changed) {
    await writeFile(file, src, 'utf8')
    transformCount++
  }
}
console.log(`✅ Phase 2: Transformed ${transformCount} files`)

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3: Create entry wrapper
// ══════════════════════════════════════════════════════════════════════════════

await writeFile(ENTRY, `// Claude Code v${VERSION} — built from source
// Copyright (c) Anthropic PBC. All rights reserved.
import './src/entrypoints/cli.tsx'
`, 'utf8')
console.log('✅ Phase 3: Created entry wrapper')

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 4: Iterative stub + bundle
// ══════════════════════════════════════════════════════════════════════════════

await ensureEsbuild()

const OUT_DIR = join(ROOT, 'dist')
await mkdir(OUT_DIR, { recursive: true })
const OUT_FILE = join(OUT_DIR, 'cli.js')

// Run up to 5 rounds of: esbuild → collect missing → create stubs → retry
const MAX_ROUNDS = 5
let succeeded = false

for (let round = 1; round <= MAX_ROUNDS; round++) {
  console.log(`\n🔨 Phase 4 round ${round}/${MAX_ROUNDS}: Bundling...`)

  let esbuildOutput = ''
  try {
    esbuildOutput = execSync([
      'npx esbuild',
      `"${ENTRY}"`,
      '--bundle',
      '--platform=node',
      '--target=node18',
      '--format=esm',
      `--outfile="${OUT_FILE}"`,
      `--banner:js=$'#!/usr/bin/env node\\n// Claude Code v${VERSION} (built from source)\\n// Copyright (c) Anthropic PBC. All rights reserved.\\n'`,
      '--alias:src=./build-src/src',
      '--packages=external',
      '--external:bun:*',
      '--loader:.md=text',
      '--loader:.txt=text',
      '--allow-overwrite',
      '--log-level=error',
      '--log-limit=0',
      '--sourcemap',
    ].join(' '), {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    }).stderr?.toString() || ''
    succeeded = true
    break
  } catch (e) {
    esbuildOutput = (e.stderr?.toString() || '') + (e.stdout?.toString() || '')
  }

  // Parse missing modules
  const missingImporters = collectMissingImporters(esbuildOutput)
  const missing = new Set(missingImporters.keys())

  if (missing.size === 0) {
    // No more missing modules but still errors — check what
    const errLines = esbuildOutput.split('\n').filter(l => l.includes('ERROR')).slice(0, 5)
    console.log('❌ Unrecoverable errors:')
    errLines.forEach(l => console.log('   ' + l))
    break
  }

  console.log(`   Found ${missing.size} missing modules, creating stubs...`)

  // Create stubs
  let stubCount = 0
  for (const mod of missing) {
    const cleanMod = mod.replace(/^\.\//, '')
    const importers = [...(missingImporters.get(mod) || [])]

    const writeStub = async (path, exportNames = []) => {
      await mkdir(dirname(path), { recursive: true }).catch(() => {})
      if (!await exists(path)) {
        await writeFile(path, renderStubModule(mod, exportNames), 'utf8')
        stubCount++
      }
    }

    // Text assets → empty file
    if (/\.(txt|md|json)$/.test(cleanMod)) {
      const candidates = importers.length
        ? importers.map(importer => resolve(dirname(importer), mod))
        : [join(BUILD, 'src', cleanMod)]
      for (const p of candidates) {
        await mkdir(dirname(p), { recursive: true }).catch(() => {})
        if (!await exists(p)) {
          await writeFile(p, cleanMod.endsWith('.json') ? '{}' : '', 'utf8')
          stubCount++
        }
      }
      continue
    }

    if (mod.endsWith('.d.ts')) {
      const candidates = importers.length
        ? importers.map(importer => resolve(dirname(importer), mod))
        : [join(BUILD, 'src', cleanMod)]
      for (const p of candidates) {
        await mkdir(dirname(p), { recursive: true }).catch(() => {})
        if (!await exists(p)) {
          await writeFile(p, '// Type stub\nexport {}\n', 'utf8')
          stubCount++
        }
      }
      continue
    }

    // JS/TS modules → export empty
    if (/\.[tj]sx?$/.test(cleanMod)) {
      if (importers.length > 0) {
        for (const importer of importers) {
          const importerSource = await readFile(importer, 'utf8').catch(() => '')
          const exportNames = collectExportNames(importerSource, mod)
          await writeStub(resolve(dirname(importer), mod), exportNames)
        }
        continue
      }

      for (const base of [join(BUILD, 'src'), join(BUILD, 'src', 'src')]) {
        await writeStub(join(base, cleanMod))
      }
    }
  }
  console.log(`   Created ${stubCount} stubs`)
}

if (succeeded) {
  const size = (await stat(OUT_FILE)).size
  console.log(`\n✅ Build succeeded: ${OUT_FILE}`)
  console.log(`   Size: ${(size / 1024 / 1024).toFixed(1)}MB`)
  console.log(`\n   Usage:  node ${OUT_FILE} --version`)
  console.log(`           node ${OUT_FILE} -p "Hello"`)
} else {
  console.error('\n❌ Build failed after all rounds.')
  console.error('   The transformed source is in build-src/ for inspection.')
  console.error('\n   To fix manually:')
  console.error('   1. Check build-src/ for the transformed files')
  console.error('   2. Create missing stubs in build-src/src/')
  console.error('   3. Re-run: node scripts/build.mjs')
  process.exit(1)
}
