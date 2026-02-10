import type { Locator } from 'playwright'
import { log } from '../../utils/logger'
import { deduplicateTexts, detectSubItems, extractLinksFromElement } from './shared'
import type { ExtractedLink, ExtractedText, TextExtractor } from './types'

export class AriaTextExtractor implements TextExtractor {
  readonly name = 'aria'
  readonly priority = 0

  async canHandle(_element: Locator): Promise<boolean> {
    // Avoid an extra round-trip (extract() will cheaply return null when empty).
    return true
  }

  async extract(element: Locator): Promise<ExtractedText | null> {
    try {
      const texts = await extractAriaTexts(element)
      if (texts.length === 0) return null

      const [links, subItems] = await Promise.all([
        extractLinksFromElement(element),
        detectSubItems(element, extractAriaTexts),
      ])

      return {
        texts,
        links,
        subItems: subItems.length > 0 ? subItems : undefined,
        confidence: computeConfidence(texts, links, subItems),
      }
    } catch (e) {
      log.debug(`AriaTextExtractor.extract error: ${e}`)
      return null
    }
  }
}

async function extractAriaTexts(element: Locator): Promise<string[]> {
  const rawTexts = await element
    .locator('span[aria-hidden="true"]')
    .allTextContents()
    .catch((): string[] => [])
  return deduplicateTexts(rawTexts)
}

function computeConfidence(texts: string[], links: ExtractedLink[], subItems: ExtractedText[]): number {
  let score = 0

  if (texts.length >= 3) score += 0.4
  else if (texts.length >= 2) score += 0.3
  else if (texts.length >= 1) score += 0.15

  if (links.length > 0) score += 0.2
  if (subItems.length > 0) score += 0.2

  const title = texts[0]
  if (title && title.length > 2 && title.length < 150) score += 0.2

  return Math.min(score, 1)
}
