export function safeJson(value) {
  return JSON.stringify(value, null, 2)
}
