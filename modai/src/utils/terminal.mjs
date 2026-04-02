const ansi = {
  reset: '\u001B[0m',
  bold: '\u001B[1m',
  dim: '\u001B[2m',
  green: '\u001B[32m',
  yellow: '\u001B[33m',
  cyan: '\u001B[36m',
  red: '\u001B[31m',
}

export function header(text) {
  return `${ansi.bold}${ansi.cyan}${text}${ansi.reset}`
}

export function renderBanner(modelId) {
  return [
    header('modAI Pro'),
    `${ansi.dim}local-first assistant for macOS Apple Silicon${ansi.reset}`,
    `${ansi.dim}active model: ${modelId}${ansi.reset}`,
  ].join('\n')
}

export function formatStatus(ok, message) {
  const color = ok ? ansi.green : ansi.yellow
  const label = ok ? 'ok' : 'warn'
  return `${color}${label}${ansi.reset} ${message}`
}

export function printKeyValueTable(rows, headings = ['key', 'value']) {
  const fullRows = [headings, ...rows].map(row => row.map(value => String(value ?? '')))
  const columnCount = Math.max(...fullRows.map(row => row.length))
  const widths = Array.from({ length: columnCount }, (_, columnIndex) =>
    Math.max(...fullRows.map(row => row[columnIndex]?.length ?? 0)),
  )

  for (const [index, row] of fullRows.entries()) {
    const paddedRow = widths.map((width, columnIndex) => (row[columnIndex] ?? '').padEnd(width, ' '))
    console.log(paddedRow.join('  '))
    if (index === 0) {
      console.log(widths.map(width => '-'.repeat(width)).join('  '))
    }
  }
}
