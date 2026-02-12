import type { Page } from 'playwright'
import { JobTopCardPageExtractor } from '../../extraction/page-extractors'
import { JobTopCardParser, type JobTopCardResult } from '../../extraction/parsers'
import { ExtractionPipeline } from '../../extraction/pipeline'
import { AriaTextExtractor, RawTextExtractor, SemanticTextExtractor } from '../../extraction/text-extractors'

export async function extractJobTopCardFromPage(page: Page): Promise<JobTopCardResult | null> {
  const pipeline = new ExtractionPipeline<JobTopCardResult>({
    pageExtractor: new JobTopCardPageExtractor(),
    textExtractors: [new AriaTextExtractor(), new SemanticTextExtractor(), new RawTextExtractor()],
    parser: new JobTopCardParser(),
    confidenceThreshold: 0.1,
    captureHtmlOnFailure: true,
  })

  const result = await pipeline.extract({
    page,
    baseUrl: page.url(),
  })

  return result.items[0] ?? null
}
