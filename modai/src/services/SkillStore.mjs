import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

export class SkillStore {
  constructor(configStore, options = {}) {
    this.configStore = configStore
    this.cwd = options.cwd ?? process.cwd()
  }

  async list(config) {
    const sources = []

    if (config.skills?.userEnabled !== false) {
      sources.push({
        source: 'user',
        root: join(this.configStore.getBaseDir(), 'skills'),
      })
    }

    if (config.skills?.projectEnabled !== false) {
      sources.push({
        source: 'project',
        root: join(this.cwd, '.modai', 'skills'),
      })
    }

    const loaded = []
    for (const entry of sources) {
      loaded.push(...await loadSkillsFromRoot(entry.root, entry.source))
    }

    return dedupeById(loaded)
  }
}

export function buildSkillPrompt(skills, activeSkillIds) {
  const active = filterActiveSkills(skills, activeSkillIds)
  if (!active.length) {
    return ''
  }

  return [
    'Loaded skills:',
    ...active.map(skill => `## ${skill.name}\n${skill.content.trim()}`),
  ].join('\n\n')
}

export function filterActiveSkills(skills, activeSkillIds = []) {
  if (!Array.isArray(activeSkillIds) || activeSkillIds.length === 0) {
    return [...skills]
  }

  const activeSet = new Set(activeSkillIds)
  return skills.filter(skill => activeSet.has(skill.id))
}

async function loadSkillsFromRoot(root, source) {
  let entries = []

  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if (isMissing(error)) {
      return []
    }
    throw error
  }

  const skills = []
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillPath = join(root, entry.name, 'SKILL.md')
      const skill = await loadSkillFile(skillPath, {
        id: entry.name,
        name: entry.name,
        source,
      })
      if (skill) {
        skills.push(skill)
      }
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      const skillPath = join(root, entry.name)
      const id = basename(entry.name, '.md')
      const skill = await loadSkillFile(skillPath, {
        id,
        name: id,
        source,
      })
      if (skill) {
        skills.push(skill)
      }
    }
  }

  return skills
}

async function loadSkillFile(path, meta) {
  try {
    const content = await readFile(path, 'utf8')
    const title = extractTitle(content) ?? meta.name
    const description = extractDescription(content)

    return {
      id: meta.id,
      name: title,
      description,
      content,
      source: meta.source,
      path,
    }
  } catch (error) {
    if (isMissing(error)) {
      return null
    }
    throw error
  }
}

function extractTitle(content) {
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean)
  const heading = lines.find(line => line.startsWith('# '))
  return heading ? heading.replace(/^#\s+/, '') : null
}

function extractDescription(content) {
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean)
  const firstPlain = lines.find(line => !line.startsWith('#'))
  return firstPlain ?? ''
}

function dedupeById(skills) {
  const seen = new Set()
  const result = []

  for (const skill of skills) {
    if (seen.has(skill.id)) {
      continue
    }
    seen.add(skill.id)
    result.push(skill)
  }

  return result
}

function isMissing(error) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}
