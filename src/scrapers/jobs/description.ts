import type { Page } from 'playwright'
import { JobDescriptionPageExtractor } from '../../extraction/page-extractors'
import { JobDescriptionParser } from '../../extraction/parsers'
import { ExtractionPipeline } from '../../extraction/pipeline'
import { AriaTextExtractor, RawTextExtractor, SemanticTextExtractor } from '../../extraction/text-extractors'
import { log } from '../../utils/logger'

export async function getJobDescription(page: Page): Promise<string | null> {
  try {
    const pipeline = new ExtractionPipeline<string>({
      pageExtractor: new JobDescriptionPageExtractor(),
      textExtractors: [new AriaTextExtractor(), new SemanticTextExtractor(), new RawTextExtractor()],
      parser: new JobDescriptionParser(),
      confidenceThreshold: 0.05,
      captureHtmlOnFailure: true,
    })

    const result = await pipeline.extract({
      page,
      baseUrl: page.url(),
    })

    return result.items[0] ?? null
  } catch (e) {
    log.debug(`Error getting job description section: ${e}`)
    return null
  }
}
