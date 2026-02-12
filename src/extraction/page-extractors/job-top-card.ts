import type { Locator } from 'playwright'
import { JOB_SELECTORS } from '../../config/constants'
import type { PageExtractor, PageExtractorConfig, PageExtractorResult } from './types'

export class JobTopCardPageExtractor implements PageExtractor {
  readonly sectionName = 'job-top-card'

  async extract(config: PageExtractorConfig): Promise<PageExtractorResult> {
    const root = await this.resolveRoot(config)

    return {
      kind: 'single',
      element: root,
      context: {},
    }
  }

  private async resolveRoot(config: PageExtractorConfig): Promise<Locator> {
    for (const selector of JOB_SELECTORS.TOP_CARD_ROOT) {
      const candidate = config.page.locator(selector).first()
      if ((await candidate.count()) > 0) return candidate
    }

    return config.page.locator('main').first()
  }
}
