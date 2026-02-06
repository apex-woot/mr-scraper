import type { Locator, Page } from 'playwright'
import { SCRAPING_CONSTANTS } from '../../config/constants'
import { log } from '../../utils/logger'
import type { ExtractedItem, ExtractionStrategy } from '../types'

/**
 * Last-resort extraction strategy using innerText() splitting.
 *
 * When all other strategies fail, this grabs the full inner text of each
 * list item and splits it by newlines. It always produces results but with
 * lower accuracy since it can't distinguish fields structurally.
 */
export class RawTextStrategy implements ExtractionStrategy {
  readonly name = 'raw-text'
  readonly priority = 3

  async canHandle(
    page: Page,
    containerSelector?: string,
  ): Promise<boolean> {
    const scope = containerSelector
      ? page.locator(containerSelector)
      : page.locator('main')

    // Raw text strategy can handle anything that has text
    const text = await scope.innerText().catch(() => '')
    return text.trim().length > 0
  }

  async findItems(
    page: Page,
    containerSelector?: string,
  ): Promise<Locator[] | null> {
    const scope = containerSelector
      ? page.locator(containerSelector)
      : page.locator('main')

    // Try list items first
    const listItems = await scope.locator('ul > li, ol > li').all()
    if (listItems.length > 0) {
      log.debug(
        `RawTextStrategy: found ${listItems.length} list items`,
      )
      return listItems
    }

    // Fall back to any direct child divs of main sections
    const sections = await scope.locator('section > div, div > div').all()
    if (sections.length > 0) {
      log.debug(
        `RawTextStrategy: found ${sections.length} section divs`,
      )
      return sections.slice(0, 50) // Cap to avoid processing the entire DOM
    }

    return null
  }

  async extractItem(item: Locator): Promise<ExtractedItem | null> {
    try {
      const rawText = await item.innerText().catch(() => '')
      if (!rawText.trim()) return null

      // Split by newlines and filter out empty/whitespace-only lines
      const lines = rawText
        .split('\n')
        .map((line) => line.trim())
        .filter(
          (line) =>
            line.length > 0 &&
            line.length < SCRAPING_CONSTANTS.MAX_FALLBACK_TEXT_LENGTH,
        )

      if (lines.length === 0) return null

      // Deduplicate adjacent identical lines (LinkedIn repeats text for a11y)
      const texts: string[] = []
      for (const line of lines) {
        if (texts.length === 0 || texts[texts.length - 1] !== line) {
          texts.push(line)
        }
      }

      if (texts.length === 0) return null

      return {
        texts,
        links: [],
        strategyUsed: this.name,
        confidence: computeConfidence(texts),
      }
    } catch (e) {
      log.debug(`RawTextStrategy.extractItem error: ${e}`)
      return null
    }
  }
}

function computeConfidence(texts: string[]): number {
  // Raw text is always low confidence since we're guessing at field boundaries
  if (texts.length >= 4) return 0.4
  if (texts.length >= 2) return 0.3
  if (texts.length >= 1) return 0.15
  return 0
}
