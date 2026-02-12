import type { Locator } from 'playwright'
import { PERSON_PAGE_SELECTOR_SETS } from './selector-sets'
import type { PageExtractor, PageExtractorConfig, PageExtractorResult } from './types'

const ROOT_SELECTORS = PERSON_PAGE_SELECTOR_SETS.TOP_CARD_ROOT

export class TopCardPageExtractor implements PageExtractor {
  readonly sectionName = 'top-card'

  async extract(config: PageExtractorConfig): Promise<PageExtractorResult> {
    const root = await this.resolveRoot(config)

    return {
      kind: 'single',
      element: root,
      context: {},
    }
  }

  private async resolveRoot(config: PageExtractorConfig): Promise<Locator> {
    for (const selector of ROOT_SELECTORS) {
      const candidate = config.page.locator(selector).first()
      if ((await candidate.count()) > 0) return candidate
    }

    return config.page.locator('main').first()
  }
}
