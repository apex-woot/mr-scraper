import type { Page } from 'playwright'
import { JobDetailsPageExtractor } from '../../extraction/page-extractors'
import { JobDetailsParser, type JobDetailsResult } from '../../extraction/parsers'
import { ExtractionPipeline } from '../../extraction/pipeline'
import { AriaTextExtractor, RawTextExtractor, SemanticTextExtractor } from '../../extraction/text-extractors'
import { log } from '../../utils/logger'

export async function getJobDetails(page: Page): Promise<JobDetailsResult | null> {
  try {
    const pipeline = new ExtractionPipeline<JobDetailsResult>({
      pageExtractor: new JobDetailsPageExtractor(),
      textExtractors: [new AriaTextExtractor(), new SemanticTextExtractor(), new RawTextExtractor()],
      parser: new JobDetailsParser(),
      confidenceThreshold: 0.1,
      captureHtmlOnFailure: true,
    })

    const result = await pipeline.extract({
      page,
      baseUrl: page.url(),
    })

    return result.items[0] ?? null
  } catch (e) {
    log.debug(`Error getting job details section: ${e}`)
    return null
  }
}
