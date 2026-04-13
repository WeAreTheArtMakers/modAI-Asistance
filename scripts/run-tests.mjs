import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const testDir = join(process.cwd(), 'modai', 'test')
const testFiles = readdirSync(testDir)
  .filter(name => name.endsWith('.test.mjs'))
  .sort()
  .map(name => join(testDir, name))

if (testFiles.length === 0) {
  console.error('No test files found in modai/test')
  process.exit(1)
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
