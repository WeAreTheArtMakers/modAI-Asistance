const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'are', 'was', 'were',
  'bir', 've', 'ile', 'icin', 'için', 'ama', 'gibi', 'daha', 'çok', 'cok', 'olan', 'olarak',
  'task', 'goal', 'due', 'gorev', 'görev', 'amac', 'amaç', 'kisitlar', 'kısıtlar',
])

export function rankSemanticMatches(query, items, options = {}) {
  const limit = normalizeLimit(options.limit)
  const minimumScore = typeof options.minimumScore === 'number' ? options.minimumScore : 0.08
  const queryProfile = createTextProfile(query)
  if (queryProfile.magnitude === 0) {
    return []
  }

  return (Array.isArray(items) ? items : [])
    .map(item => {
      const text = String(item?.semanticText ?? item?.content ?? item?.text ?? '').trim()
      const profile = createTextProfile(text)
      const score = cosineSimilarity(queryProfile, profile)
      return {
        ...item,
        score: Number(score.toFixed(4)),
      }
    })
    .filter(item => item.score >= minimumScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
}

export function createTextProfile(input) {
  const tokens = tokenize(input)
  const features = new Map()

  for (const token of tokens) {
    addFeature(features, token, 2)
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    addFeature(features, `${tokens[index]}_${tokens[index + 1]}`, 1.1)
  }

  const compact = tokens.join('')
  for (let index = 0; index <= compact.length - 3; index += 1) {
    addFeature(features, `#${compact.slice(index, index + 3)}`, 0.12)
  }

  let magnitude = 0
  for (const weight of features.values()) {
    magnitude += weight ** 2
  }

  return {
    features,
    magnitude: Math.sqrt(magnitude),
  }
}

function tokenize(input) {
  return String(input ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[\p{L}\p{N}_-]+/gu)?.filter(token => token.length > 1 && !STOPWORDS.has(token)) ?? []
}

function cosineSimilarity(left, right) {
  if (!left.magnitude || !right.magnitude) {
    return 0
  }

  let dotProduct = 0
  for (const [feature, weight] of left.features.entries()) {
    dotProduct += weight * (right.features.get(feature) ?? 0)
  }

  return dotProduct / (left.magnitude * right.magnitude)
}

function addFeature(features, feature, weight) {
  features.set(feature, (features.get(feature) ?? 0) + weight)
}

function normalizeLimit(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(1, Math.min(20, Math.round(parsed))) : 6
}
