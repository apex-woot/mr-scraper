import type { Locator, Page } from 'playwright'
import { log } from '../../utils/logger'
import type { ExtractedItem, ExtractedLink, ExtractionStrategy } from '../types'

/**
 * Semantic HTML extraction strategy.
 *
 * Uses standard HTML semantics (headings, lists, links, paragraphs) rather than
 * LinkedIn-specific classes or ARIA attributes. Lower accuracy than AriaStrategy
 * but still resilient to class name changes.
 */
export class SemanticStrategy implements ExtractionStrategy {
  readonly name = 'semantic'
  readonly priority = 1

  async canHandle(
    page: Page,
    containerSelector?: string,
  ): Promise<boolean> {
    const scope = containerSelector
      ? page.locator(containerSelector)
      : page.locator('main')

    const listItems = await scope
      .locator('ul > li, ol > li')
      .count()
      .catch(() => 0)
    return listItems > 0
  }

  async findItems(
    page: Page,
    containerSelector?: string,
  ): Promise<Locator[] | null> {
    const scope = containerSelector
      ? page.locator(containerSelector)
      : page.locator('main')

    // Find the most prominent list
    const lists = await scope.locator('ul, ol').all()

    for (const list of lists) {
      const items = await list.locator('> li').all()
      if (items.length >= 1) {
        log.debug(
          `SemanticStrategy: found ${items.length} items in list`,
        )
        return items
      }
    }

    return null
  }

  async extractItem(item: Locator): Promise<ExtractedItem | null> {
    try {
      const texts = await extractSemanticTexts(item)
      if (texts.length === 0) return null

      const links = await extractSemanticLinks(item)

      return {
        texts,
        links,
        strategyUsed: this.name,
        confidence: computeConfidence(texts),
      }
    } catch (e) {
      log.debug(`SemanticStrategy.extractItem error: ${e}`)
      return null
    }
  }
}

/**
 * Extracts text using semantic HTML elements: headings, paragraphs, spans.
 * Prioritizes headings as titles, then paragraphs for metadata.
 */
async function extractSemanticTexts(element: Locator): Promise<string[]> {
  const texts: string[] = []
  const seen = new Set<string>()

  // Headings first (likely titles)
  const headings = await element.locator('h1, h2, h3, h4, h5, h6').all()
  for (const h of headings) {
    const text = (await h.textContent())?.trim()
    if (text && !seen.has(text)) {
      seen.add(text)
      texts.push(text)
    }
  }

  // Then paragraphs (metadata fields)
  const paragraphs = await element.locator('p').all()
  for (const p of paragraphs) {
    const text = (await p.textContent())?.trim()
    if (text && text.length < 500 && !seen.has(text)) {
      seen.add(text)
      texts.push(text)
    }
  }

  // Fallback to spans if nothing else found
  if (texts.length === 0) {
    const spans = await element.locator('span').all()
    for (const span of spans) {
      const text = (await span.textContent())?.trim()
      if (text && text.length > 1 && text.length < 300 && !seen.has(text)) {
        // Skip if it's a substring of an existing text
        let isSubstring = false
        for (const existing of seen) {
          if (existing.includes(text) || text.includes(existing)) {
            isSubstring = true
            break
          }
        }
        if (!isSubstring) {
          seen.add(text)
          texts.push(text)
        }
      }
    }
  }

  return texts
}

async function extractSemanticLinks(item: Locator): Promise<ExtractedLink[]> {
  const anchors = await item.locator('a[href]').all()
  const links: ExtractedLink[] = []

  for (const anchor of anchors) {
    try {
      const href = await anchor.getAttribute('href')
      if (!href) continue

      const text = (await anchor.textContent())?.trim() ?? ''
      links.push({
        url: href,
        text,
        isExternal: !href.includes('linkedin.com'),
      })
    } catch {
      continue
    }
  }

  return links
}

function computeConfidence(texts: string[]): number {
  // Semantic strategy is inherently less precise
  if (texts.length >= 3) return 0.6
  if (texts.length >= 2) return 0.45
  if (texts.length >= 1) return 0.25
  return 0
}
