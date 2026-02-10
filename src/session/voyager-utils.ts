export function isVoyagerApiUrl(url: string, matchers: readonly string[] = ['/voyager/api/']): boolean {
  return matchers.some((m) => url.includes(m))
}

export function extractCookieValue(cookieHeader: string, name: string): string | undefined {
  // Cookie header format: "a=b; c=d; e=f".
  // This is intentionally simple; we only need best-effort extraction.
  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const [rawKey, ...rawValueParts] = part.trim().split('=')
    if (!rawKey) continue
    if (rawKey === name) {
      const rawValue = rawValueParts.join('=')
      return rawValue.length > 0 ? rawValue : undefined
    }
  }
  return undefined
}

export function normalizeJsessionId(value: string): string {
  // JSESSIONID often appears quoted: "ajax:123" or "123".
  // We keep any prefix like "ajax:" but remove surrounding quotes.
  const trimmed = value.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

export function normalizeCsrfToken(value: string): string {
  const trimmed = value.trim()
  const noQuotes = normalizeJsessionId(trimmed)
  return noQuotes.startsWith('ajax:') ? noQuotes.slice('ajax:'.length) : noQuotes
}

export function getJsessionIdFromCookieHeader(cookieHeader: string): string | undefined {
  const raw = extractCookieValue(cookieHeader, 'JSESSIONID')
  if (!raw) return undefined
  return normalizeJsessionId(raw)
}

export function csrfMatchesJsession(csrfToken: string, cookieHeader: string): boolean | undefined {
  const jsession = getJsessionIdFromCookieHeader(cookieHeader)
  if (!jsession) return undefined

  const normalizedCsrf = normalizeCsrfToken(csrfToken)
  const normalizedJsession = normalizeCsrfToken(jsession)
  return normalizedCsrf === normalizedJsession
}

export interface CookieLike {
  name: string
  value: string
}

export function buildCookieHeaderFromCookies(
  cookies: readonly CookieLike[],
  cookieNames?: readonly string[],
): string | undefined {
  if (cookies.length === 0) return undefined

  const selected: CookieLike[] = []
  if (cookieNames && cookieNames.length > 0) {
    const byName = new Map(cookies.map((c) => [c.name, c.value] as const))
    for (const name of cookieNames) {
      const value = byName.get(name)
      if (value) selected.push({ name, value })
    }
  } else {
    selected.push(...cookies)
  }

  if (selected.length === 0) return undefined
  return selected.map((c) => `${c.name}=${c.value}`).join('; ')
}
