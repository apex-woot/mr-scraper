import type { Locator } from 'playwright'
import type { ExtractedLink, ExtractedText } from './types'

export function deduplicateTexts(texts: string[]): string[] {
  const exactSeen = new Set<string>()
  const kept: string[] = []

  // Token index to reduce substring comparisons.
  const tokenIndex = new Map<string, string[]>()

  for (const rawText of texts) {
    const text = rawText.trim()
    if (!text || exactSeen.has(text)) continue

    const keys = buildSubstringKeys(text)
    const candidates = new Set<string>()
    for (const key of keys) {
      const bucket = tokenIndex.get(key)
      if (!bucket) continue
      for (const existing of bucket) candidates.add(existing)
    }

    let isSubstringRelated = false
    for (const existing of candidates) {
      if ((existing.length > 3 && text.includes(existing)) || (text.length > 3 && existing.includes(text))) {
        isSubstringRelated = true
        break
      }
    }

    if (isSubstringRelated) continue

    exactSeen.add(text)
    kept.push(text)
    for (const key of keys) {
      const bucket = tokenIndex.get(key)
      if (bucket) bucket.push(text)
      else tokenIndex.set(key, [text])
    }
  }

  return kept
}

export async function extractLinksFromElement(element: Locator): Promise<ExtractedLink[]> {
  const raw = await element
    .locator('a[href]')
    .evaluateAll((anchors) =>
      anchors.map((a) => ({
        href: a.getAttribute('href'),
        text: (a.textContent ?? '').trim(),
      })),
    )
    .catch((): Array<{ href: string | null; text: string }> => [])

  const links: ExtractedLink[] = []
  for (const { href, text } of raw) {
    if (!href) continue
    links.push({
      url: href,
      text,
      isExternal: !href.includes('linkedin.com'),
    })
  }

  return links
}

export async function detectSubItems(
  element: Locator,
  textExtractFn: (el: Locator) => Promise<string[]>,
): Promise<ExtractedText[]> {
  const subItems: ExtractedText[] = []

  try {
    const nestedUl = element.locator('ul').first()
    if ((await nestedUl.count()) === 0) return subItems

    const nestedLis = await nestedUl.locator('> li').all()
    if (nestedLis.length <= 1) return subItems

    // Keep this best-effort and conservative on concurrency to avoid
    // overwhelming the Playwright connection with per-li calls.
    const concurrency = 4
    const results: Array<ExtractedText | null> = new Array(nestedLis.length).fill(null)
    let nextIndex = 0

    const workers: Array<Promise<void>> = []
    for (let w = 0; w < Math.min(concurrency, nestedLis.length); w++) {
      workers.push(
        (async () => {
          while (nextIndex < nestedLis.length) {
            const i = nextIndex
            nextIndex++

            const li = nestedLis[i]
            if (!li) continue

            const [texts, links] = await Promise.all([textExtractFn(li), extractLinksFromElement(li)])
            if (texts.length === 0) continue

            results[i] = {
              texts,
              links,
              confidence: texts.length >= 2 ? 0.8 : 0.5,
            }
          }
        })(),
      )
    }

    await Promise.all(workers)
    for (const item of results) {
      if (item) subItems.push(item)
    }
  } catch {
    // Best-effort nested extraction.
  }

  return subItems
}

function buildSubstringKeys(text: string): string[] {
  const lower = text.toLowerCase()
  const keys = new Set<string>()

  // Prefer word tokens (most real substring duplicates share tokens).
  for (const token of lower.split(/\s+/)) {
    const t = token.replace(/[^a-z0-9]/g, '')
    if (t.length >= 4) keys.add(t)
    if (keys.size >= 6) break
  }

  // Fallback to a short prefix key for compact strings.
  if (keys.size === 0) keys.add(lower.slice(0, 8))

  return [...keys]
}
