export async function getJson(url, options = {}) {
  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: options.headers,
  })
  return parseJsonResponse(response)
}

export async function postJson(url, body, options = {}) {
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
    body: JSON.stringify(body),
  })
  return parseJsonResponse(response)
}

async function fetchWithTimeout(url, init) {
  const controller = new AbortController()
  const timeoutMs = init.timeoutMs ?? 90_000
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function parseJsonResponse(response) {
  const text = await response.text()
  let data = null

  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`Expected JSON response, received: ${text.slice(0, 200)}`)
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(data)}`)
  }

  return data
}
