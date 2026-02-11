import type { Page } from 'playwright'
import { PatentPageExtractor } from '../../extraction/page-extractors'
import { PatentParser } from '../../extraction/parsers'
import { ExtractionPipeline } from '../../extraction/pipeline'
import { AriaTextExtractor, RawTextExtractor, SemanticTextExtractor } from '../../extraction/text-extractors'
import type { Patent } from '../../models/person'
import { log } from '../../utils/logger'
import { deduplicateItems } from './common-patterns'

type EmptyReason = 'empty-section' | 'selector-miss' | 'parser-rejected' | 'navigation-miss' | 'unknown-empty'

function detectPatentEmptyReason(
  currentUrl: string,
  capturedHtml: string | undefined,
  itemsFound: number,
  itemsParsed: number,
): EmptyReason {
  if (!currentUrl.includes('/details/patents')) return 'navigation-miss'
  if (capturedHtml?.includes('Nothing to see for now')) return 'empty-section'
  if (itemsFound === 0) return 'selector-miss'
  if (itemsFound > 0 && itemsParsed === 0) return 'parser-rejected'
  return 'unknown-empty'
}

export async function getPatents(page: Page, baseUrl: string, includeRaw: boolean = false): Promise<Patent[]> {
  try {
    const pipeline = new ExtractionPipeline<Patent>({
      pageExtractor: new PatentPageExtractor(),
      textExtractors: [new AriaTextExtractor(), new SemanticTextExtractor(), new RawTextExtractor()],
      parser: new PatentParser(),
      includeRaw,
      confidenceThreshold: 0.25,
      captureHtmlOnFailure: true,
      deduplicateKey: (patent) => `${patent.title}|${patent.number || ''}`,
    })

    const result = await pipeline.extract({ page, baseUrl })
    const reason =
      result.items.length > 0
        ? 'ok'
        : detectPatentEmptyReason(
            page.url(),
            result.diagnostics.capturedHtml,
            result.diagnostics.itemsFound,
            result.diagnostics.itemsParsed,
          )
    log.info(
      `Got ${result.items.length} patents (extractor: ${result.diagnostics.textExtractorUsed ?? 'none'}, confidence: ${result.diagnostics.avgConfidence.toFixed(2)}, reason: ${reason})`,
    )

    return deduplicateItems(result.items, (p) => `${p.title}|${p.number || ''}`)
  } catch (e) {
    log.warning(`Error getting patents: ${e}`)
    return []
  }
}
