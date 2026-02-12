import type { Locator } from 'playwright'
import { JOB_SELECTORS } from '../../config/constants'
import type { PageExtractor, PageExtractorConfig, PageExtractorResult } from './types'

export class JobDescriptionPageExtractor implements PageExtractor {
  readonly sectionName = 'job-description'

  async extract(config: PageExtractorConfig): Promise<PageExtractorResult> {
    const element = await this.resolveElement(config)

    return {
      kind: 'single',
      element,
      context: {},
    }
  }

  private async resolveElement(config: PageExtractorConfig): Promise<Locator> {
    for (const selector of JOB_SELECTORS.DESCRIPTION_ROOT) {
      const candidate = config.page.locator(selector).first()
      if ((await candidate.count()) > 0) return candidate
    }

    return config.page.locator('main').first()
  }
}
