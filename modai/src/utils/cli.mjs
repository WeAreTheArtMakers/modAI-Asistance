import { spawn } from 'node:child_process'

export function parseFlags(argv) {
  const booleans = new Set()
  const values = new Map()
  const positionals = []

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '--') {
      positionals.push(...argv.slice(index + 1))
      break
    }

    if (token.startsWith('--')) {
      const [name, inlineValue] = token.slice(2).split('=')
      if (inlineValue !== undefined) {
        values.set(name, inlineValue)
      } else {
        const next = argv[index + 1]
        if (next && !next.startsWith('-')) {
          values.set(name, next)
          index += 1
        } else {
          booleans.add(name)
        }
      }
      continue
    }

    if (token.startsWith('-') && token.length === 2) {
      const shortName = token.slice(1)
      const next = argv[index + 1]
      if (next && !next.startsWith('-')) {
        values.set(shortName, next)
        index += 1
      } else {
        booleans.add(shortName)
      }
      continue
    }

    positionals.push(token)
  }

  return { booleans, values, positionals }
}

export function readFlag(parsed, shortName, longName) {
  return parsed.values.get(shortName) ?? parsed.values.get(longName) ?? null
}

export async function commandExists(command) {
  return new Promise(resolve => {
    const child = spawn('which', [command])
    child.on('close', code => resolve(code === 0))
    child.on('error', () => resolve(false))
  })
}
