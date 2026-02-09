import { SCRAPING_CONSTANTS } from '../../config/constants'
import { findItemsWithFallback, navigateToSection, scrollSection, sectionHasContent } from './helpers'
import type { PageExtractor, PageExtractorConfig, PageExtractorResult } from './types'

export interface AccomplishmentPageExtractorOptions {
  urlPath: string
  category: string
}

export class AccomplishmentPageExtractor implements PageExtractor {
  readonly sectionName = 'accomplishment'

  private readonly urlPath: string
  private readonly category: string

  constructor(options: AccomplishmentPageExtractorOptions) {
    this.urlPath = options.urlPath
    this.category = options.category
  }

  async extract(config: PageExtractorConfig): Promise<PageExtractorResult> {
    const didNavigate = await navigateToSection(
      config.page,
      config.baseUrl,
      `details/${this.urlPath}/`,
      config.focusWait ?? SCRAPING_CONSTANTS.ACCOMPLISHMENTS_FOCUS_WAIT,
    )

    if (!didNavigate) return { kind: 'list', items: [] }

    const hasContent = await sectionHasContent(config.page)
    if (!hasContent) return { kind: 'list', items: [] }

    await scrollSection(config.page, {
      pauseTime: config.scroll?.pauseTime ?? SCRAPING_CONSTANTS.ACCOMPLISHMENTS_SCROLL_PAUSE,
      maxScrolls: config.scroll?.maxScrolls ?? SCRAPING_CONSTANTS.ACCOMPLISHMENTS_MAX_SCROLLS,
    })

    const items = await findItemsWithFallback(config.page, this.sectionName)
    return {
      kind: 'list',
      items: items.map((locator) => ({
        locator,
        context: { category: this.category },
      })),
    }
  }
}
