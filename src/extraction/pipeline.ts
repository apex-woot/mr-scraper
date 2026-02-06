import type { Page } from 'playwright'
import { log } from '../utils/logger'
import type {
  ExtractionStrategy,
  PipelineDiagnostics,
  PipelineResult,
  SectionInterpreter,
} from './types'

interface PipelineOptions {
  /** Minimum confidence to accept a strategy's results (default 0.5) */
  confidenceThreshold?: number
  /** Capture raw HTML on failure for self-healing (default false) */
  captureHtmlOnFailure?: boolean
  /** CSS selector to scope extraction (e.g. a section container) */
  containerSelector?: string
}

/**
 * Orchestrates extraction by trying strategies in priority order.
 * Stops when one produces results above a confidence threshold.
 *
 * @typeParam T - The domain model type (Experience, Accomplishment, etc.)
 */
export class ExtractionPipeline<T> {
  private readonly strategies: ExtractionStrategy[]
  private readonly interpreter: SectionInterpreter<T>
  private readonly options: Required<PipelineOptions>

  constructor(
    strategies: ExtractionStrategy[],
    interpreter: SectionInterpreter<T>,
    options: PipelineOptions = {},
  ) {
    // Sort by priority (lower = higher priority)
    this.strategies = [...strategies].sort((a, b) => a.priority - b.priority)
    this.interpreter = interpreter
    this.options = {
      confidenceThreshold: options.confidenceThreshold ?? 0.5,
      captureHtmlOnFailure: options.captureHtmlOnFailure ?? false,
      containerSelector: options.containerSelector ?? '',
    }
  }

  async extract(page: Page): Promise<PipelineResult<T>> {
    const startTime = Date.now()
    const diagnostics: PipelineDiagnostics = {
      strategiesAttempted: [],
      strategiesFailed: [],
      strategyUsed: null,
      itemsFound: 0,
      itemsParsed: 0,
      itemsFailed: 0,
      durationMs: 0,
    }

    for (const strategy of this.strategies) {
      diagnostics.strategiesAttempted.push(strategy.name)

      try {
        const canHandle = await strategy.canHandle(
          page,
          this.options.containerSelector || undefined,
        )
        if (!canHandle) {
          log.debug(`Pipeline: ${strategy.name} cannot handle this page`)
          diagnostics.strategiesFailed.push(strategy.name)
          continue
        }

        const items = await strategy.findItems(
          page,
          this.options.containerSelector || undefined,
        )
        if (!items || items.length === 0) {
          log.debug(`Pipeline: ${strategy.name} found no items`)
          diagnostics.strategiesFailed.push(strategy.name)
          continue
        }

        diagnostics.itemsFound = items.length
        log.debug(
          `Pipeline: ${strategy.name} found ${items.length} items, extracting...`,
        )

        const results: T[] = []
        let totalConfidence = 0

        for (const item of items) {
          try {
            const extracted = await strategy.extractItem(item)
            if (!extracted) {
              diagnostics.itemsFailed++
              continue
            }

            const interpreted = this.interpreter.interpret(extracted)
            if (!interpreted) {
              diagnostics.itemsFailed++
              continue
            }

            if (this.interpreter.validate(interpreted)) {
              results.push(interpreted)
              totalConfidence += extracted.confidence
              diagnostics.itemsParsed++
            } else {
              diagnostics.itemsFailed++
            }
          } catch (e) {
            log.debug(`Pipeline: error processing item: ${e}`)
            diagnostics.itemsFailed++
          }
        }

        if (results.length === 0) {
          diagnostics.strategiesFailed.push(strategy.name)
          continue
        }

        const avgConfidence = totalConfidence / results.length

        if (avgConfidence >= this.options.confidenceThreshold) {
          diagnostics.strategyUsed = strategy.name
          diagnostics.durationMs = Date.now() - startTime
          log.debug(
            `Pipeline: ${strategy.name} succeeded with ${results.length} items (confidence: ${avgConfidence.toFixed(2)})`,
          )

          return {
            items: results,
            strategy: strategy.name,
            confidence: avgConfidence,
            diagnostics,
          }
        }

        // Below threshold but has results - keep trying but remember as fallback
        log.debug(
          `Pipeline: ${strategy.name} below confidence threshold (${avgConfidence.toFixed(2)} < ${this.options.confidenceThreshold})`,
        )
        diagnostics.strategiesFailed.push(strategy.name)
      } catch (e) {
        log.debug(`Pipeline: ${strategy.name} threw: ${e}`)
        diagnostics.strategiesFailed.push(strategy.name)
      }
    }

    // All strategies failed
    if (this.options.captureHtmlOnFailure) {
      try {
        const scope = this.options.containerSelector
          ? page.locator(this.options.containerSelector)
          : page.locator('main')
        const html = await scope.innerHTML().catch(() => '')
        // Trim to reasonable size for LLM processing
        diagnostics.capturedHtml = html.slice(0, 8000)
      } catch {
        // Best effort
      }
    }

    diagnostics.durationMs = Date.now() - startTime
    log.debug(
      `Pipeline: all strategies failed for ${this.interpreter.sectionName}`,
    )

    return {
      items: [],
      strategy: 'none',
      confidence: 0,
      diagnostics,
    }
  }
}
