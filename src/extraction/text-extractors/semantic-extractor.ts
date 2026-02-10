import type { Locator } from 'playwright'
import { log } from '../../utils/logger'
import { deduplicateTexts, extractLinksFromElement } from './shared'
import type { ExtractedText, TextExtractor } from './types'

export class SemanticTextExtractor implements TextExtractor {
  readonly name = 'semantic'
  readonly priority = 1

  async canHandle(_element: Locator): Promise<boolean> {
    // Avoid an extra round-trip (extract() will cheaply return null when empty).
    return true
  }

  async extract(element: Locator): Promise<ExtractedText | null> {
    try {
      const [texts, links] = await Promise.all([extractSemanticTexts(element), extractLinksFromElement(element)])
      if (texts.length === 0) return null

      return {
        texts,
        links,
        confidence: computeConfidence(texts),
      }
    } catch (e) {
      log.debug(`SemanticTextExtractor.extract error: ${e}`)
      return null
    }
  }
}

async function extractSemanticTexts(element: Locator): Promise<string[]> {
  const rawTexts = await element
    .locator('h1, h2, h3, h4, h5, h6, p, .text-body-medium, .text-body-small')
    .allTextContents()
    .catch((): string[] => [])

  let deduped = deduplicateTexts(rawTexts)
  if (deduped.length >= 2) return deduped

  const spanTexts = await element
    .locator('span')
    .allTextContents()
    .catch((): string[] => [])

  deduped = deduplicateTexts([...rawTexts, ...spanTexts])
  return deduped.filter((text) => text.length > 1)
}

function computeConfidence(texts: string[]): number {
  if (texts.length >= 3) return 0.6
  if (texts.length >= 2) return 0.45
  if (texts.length >= 1) return 0.25
  return 0
}
