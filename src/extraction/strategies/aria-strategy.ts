import type { Locator, Page } from 'playwright'
import { log } from '../../utils/logger'
import { selectorRegistry } from '../registry'
import type { ExtractedItem, ExtractedLink, ExtractionStrategy } from '../types'

/**
 * Primary extraction strategy using span[aria-hidden="true"].
 *
 * This mirrors the Python linkedin_scraper's approach. LinkedIn always renders
 * visible text inside `<span aria-hidden="true">` for accessibility, making
 * this the most resilient selector across layout changes.
 */
export class AriaStrategy implements ExtractionStrategy {
  readonly name = 'aria'
  readonly priority = 0
  private readonly sectionName: string

  constructor(sectionName: string = 'experience') {
    this.sectionName = sectionName
  }

  async canHandle(
    page: Page,
    containerSelector?: string,
  ): Promise<boolean> {
    const scope = containerSelector
      ? page.locator(containerSelector)
      : page.locator('main')

    const count = await scope
      .locator('span[aria-hidden="true"]')
      .count()
      .catch(() => 0)
    return count > 0
  }

  async findItems(
    page: Page,
    containerSelector?: string,
  ): Promise<Locator[] | null> {
    const sectionConfig = selectorRegistry.getSection(this.sectionName)
    const selectorChain = sectionConfig?.itemSelectors ?? [
      'main ul > li',
      'main ol > li',
    ]

    const scopeSelector =
      containerSelector ||
      sectionConfig?.containerSelectors?.[0] ||
      'main'
    const scope = page.locator(scopeSelector)

    for (const selector of selectorChain) {
      try {
        const locator = selector.startsWith('main ')
          ? page.locator(selector)
          : scope.locator(selector)
        const items = await locator.all()
        if (items.length > 0) {
          log.debug(
            `AriaStrategy: found ${items.length} items with "${selector}"`,
          )
          return items
        }
      } catch {
        continue
      }
    }

    // Ultimate fallback: direct children of any list in main
    try {
      const items = await scope.locator('ul > li, ol > li').all()
      if (items.length > 0) {
        log.debug(
          `AriaStrategy: found ${items.length} items with generic list fallback`,
        )
        return items
      }
    } catch {
      // fall through
    }

    return null
  }

  async extractItem(item: Locator): Promise<ExtractedItem | null> {
    try {
      const texts = await extractAriaTexts(item)
      if (texts.length === 0) return null

      const links = await extractLinks(item)
      const subItems = await detectSubItems(item)

      return {
        texts,
        links,
        subItems: subItems.length > 0 ? subItems : undefined,
        strategyUsed: this.name,
        confidence: computeConfidence(texts, links, subItems),
      }
    } catch (e) {
      log.debug(`AriaStrategy.extractItem error: ${e}`)
      return null
    }
  }
}

/**
 * Extracts unique, ordered text from span[aria-hidden="true"] elements.
 * Filters duplicates and substring overlaps (LinkedIn often renders the same
 * text in both a visible and screen-reader span).
 */
async function extractAriaTexts(element: Locator): Promise<string[]> {
  const spans = await element.locator('span[aria-hidden="true"]').all()

  const seen = new Set<string>()
  const texts: string[] = []

  for (const span of spans) {
    const raw = await span.textContent().catch(() => null)
    if (!raw) continue

    const text = raw.trim()
    if (!text || text.length > 500) continue

    // Skip if we've seen this exact text or it's a substring/superstring of existing
    if (seen.has(text)) continue

    let isSubstring = false
    for (const existing of seen) {
      if (
        (existing.length > 3 && text.includes(existing)) ||
        (text.length > 3 && existing.includes(text))
      ) {
        isSubstring = true
        break
      }
    }

    if (!isSubstring) {
      seen.add(text)
      texts.push(text)
    }
  }

  return texts
}

/**
 * Extracts links from an item, classifying them as internal (LinkedIn) or external.
 */
async function extractLinks(item: Locator): Promise<ExtractedLink[]> {
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

/**
 * Detects nested items (e.g. multiple positions at the same company).
 * Looks for nested `ul > li` patterns within an item.
 */
async function detectSubItems(
  item: Locator,
): Promise<ExtractedItem[]> {
  const subItems: ExtractedItem[] = []

  try {
    const nestedUl = item.locator('ul').first()
    if ((await nestedUl.count()) === 0) return subItems

    const nestedLis = await nestedUl.locator('> li').all()
    if (nestedLis.length <= 1) return subItems

    for (const li of nestedLis) {
      const texts = await extractAriaTexts(li)
      if (texts.length === 0) continue

      const links = await extractLinks(li)
      subItems.push({
        texts,
        links,
        strategyUsed: 'aria',
        confidence: texts.length >= 2 ? 0.8 : 0.5,
      })
    }
  } catch {
    // Nesting detection is best-effort
  }

  return subItems
}

function computeConfidence(
  texts: string[],
  links: ExtractedLink[],
  subItems: ExtractedItem[],
): number {
  let score = 0

  // Having multiple text fields is a strong signal
  if (texts.length >= 3) score += 0.4
  else if (texts.length >= 2) score += 0.3
  else if (texts.length >= 1) score += 0.15

  // Having links suggests structured content
  if (links.length > 0) score += 0.2

  // Sub-items indicate a well-structured multi-position entry
  if (subItems.length > 0) score += 0.2

  // Title length sanity check
  const title = texts[0]
  if (title && title.length > 2 && title.length < 150) score += 0.2

  return Math.min(score, 1)
}
