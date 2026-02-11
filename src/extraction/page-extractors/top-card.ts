import type { Locator } from 'playwright'
import { COMMON_SELECTORS } from '../../config/constants'
import type { PageExtractor, PageExtractorConfig, PageExtractorResult } from './types'

const ROOT_SELECTORS = [
  'main section.artdeco-card[data-member-id]:has(h1)',
  'section.artdeco-card[data-member-id]:has(h1)',
  '.pv-top-card:has(h1)',
  '[data-view-name*="top-card" i]:has(h1)',
  'main section.artdeco-card:has(h1)',
  COMMON_SELECTORS.PROFILE_TOP_CARD_ROOT,
  'main section:has(h1)',
] as const

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
