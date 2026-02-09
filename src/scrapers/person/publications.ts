import type { Page } from 'playwright'
import { AccomplishmentPageExtractor } from '../../extraction/page-extractors'
import { AccomplishmentParser } from '../../extraction/parsers'
import { ExtractionPipeline } from '../../extraction/pipeline'
import { AriaTextExtractor, RawTextExtractor, SemanticTextExtractor } from '../../extraction/text-extractors'
import type { Accomplishment } from '../../models'
import { log } from '../../utils/logger'
import { navigateAndWait, waitAndFocus } from '../utils'
import { deduplicateItems } from './common-patterns'

type EmptyReason =
  | 'empty-section'
  | 'selector-miss'
  | 'parser-rejected'
  | 'dom-thin-page'
  | 'navigation-miss'
  | 'unknown-empty'

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function detectEmptyReason(
  currentUrl: string,
  expectedPath: string,
  capturedHtml: string | undefined,
  itemsFound: number,
  itemsParsed: number,
): EmptyReason {
  if (!currentUrl.includes(expectedPath)) return 'navigation-miss'
  if (capturedHtml?.includes('Nothing to see for now')) return 'empty-section'
  if ((capturedHtml?.length ?? 0) > 0 && (capturedHtml?.length ?? 0) < 2500) return 'dom-thin-page'
  if (itemsFound === 0) return 'selector-miss'
  if (itemsFound > 0 && itemsParsed === 0) return 'parser-rejected'
  return 'unknown-empty'
}

export async function getPublications(page: Page, baseUrl: string): Promise<Accomplishment[]> {
  try {
    const normalizedBase = normalizeBaseUrl(baseUrl)
    const expectedPath = '/details/publications'
    const detailsUrl = `${normalizedBase}/details/publications/`

    const pipeline = new ExtractionPipeline<Accomplishment>({
      pageExtractor: new AccomplishmentPageExtractor({
        urlPath: 'publications',
        category: 'publication',
      }),
      textExtractors: [new AriaTextExtractor(), new SemanticTextExtractor(), new RawTextExtractor()],
      parser: new AccomplishmentParser(),
      confidenceThreshold: 0.25,
      captureHtmlOnFailure: true,
      deduplicateKey: (publication) => `${publication.category}|${publication.title}`,
    })

    const result = await pipeline.extract({ page, baseUrl: normalizedBase })

    if (result.items.length === 0) {
      const firstReason = detectEmptyReason(
        page.url(),
        expectedPath,
        result.diagnostics.capturedHtml,
        result.diagnostics.itemsFound,
        result.diagnostics.itemsParsed,
      )

      log.info(
        `Publications returned 0 items on first attempt (reason: ${firstReason}). Retrying via direct details URL.`,
      )

      await navigateAndWait(page, detailsUrl)
      await page.waitForSelector('main', { timeout: 10000 })
      await waitAndFocus(page, 0.8)

      const retry = await pipeline.extract({ page, baseUrl: normalizedBase })
      const retryReason = detectEmptyReason(
        page.url(),
        expectedPath,
        retry.diagnostics.capturedHtml,
        retry.diagnostics.itemsFound,
        retry.diagnostics.itemsParsed,
      )

      log.info(
        `Got ${retry.items.length} publications (extractor: ${retry.diagnostics.textExtractorUsed ?? 'none'}, confidence: ${retry.diagnostics.avgConfidence.toFixed(2)}, reason: ${retry.items.length === 0 ? retryReason : 'ok'})`,
      )

      return deduplicateItems(retry.items, (item) => `${item.category}|${item.title}`)
    }

    log.info(
      `Got ${result.items.length} publications (extractor: ${result.diagnostics.textExtractorUsed ?? 'none'}, confidence: ${result.diagnostics.avgConfidence.toFixed(2)}, reason: ok)`,
    )

    return deduplicateItems(result.items, (item) => `${item.category}|${item.title}`)
  } catch (e) {
    log.warning(`Error getting publications: ${e}`)
    return []
  }
}
