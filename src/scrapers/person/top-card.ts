import type { Page } from 'playwright'
import { TopCardPageExtractor } from '../../extraction/page-extractors'
import { TopCardParser, type TopCardResult } from '../../extraction/parsers'
import { ExtractionPipeline } from '../../extraction/pipeline'
import type { TextExtractor } from '../../extraction/text-extractors'
import { AriaTextExtractor, RawTextExtractor, SemanticTextExtractor } from '../../extraction/text-extractors'

export interface TopCardPersonInfo {
  name: string
  headline: string | null
  currentPosition: string | null
  origin: string | null
}

export async function extractTopCardFromPage(page: Page): Promise<TopCardPersonInfo> {
  const ariaExtractor = new AriaTextExtractor()
  const deprioritizedAriaExtractor: TextExtractor = {
    name: ariaExtractor.name,
    priority: 2,
    canHandle: (element) => ariaExtractor.canHandle(element),
    extract: (element) => ariaExtractor.extract(element),
  }

  const pipeline = new ExtractionPipeline<TopCardResult>({
    pageExtractor: new TopCardPageExtractor(),
    textExtractors: [new SemanticTextExtractor(), deprioritizedAriaExtractor, new RawTextExtractor()],
    parser: new TopCardParser(),
    confidenceThreshold: 0.15,
    captureHtmlOnFailure: true,
  })

  const result = await pipeline.extract({
    page,
    baseUrl: page.url(),
  })
  const topCard = result.items[0]

  return {
    name: topCard?.name ?? 'Unknown',
    headline: topCard?.headline ?? null,
    currentPosition: topCard?.currentPosition ?? null,
    origin: topCard?.origin ?? null,
  }
}
