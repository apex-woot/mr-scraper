import type { Locator, Page } from 'playwright'

export interface ExtractedLink {
  url: string
  text: string
  isExternal: boolean
}

export interface ExtractedItem {
  /** Ordered text fields: title first, then metadata */
  texts: string[]
  /** Links found within this item */
  links: ExtractedLink[]
  /** Nested items (e.g. multi-position experiences) */
  subItems?: ExtractedItem[]
  /** Raw HTML for debugging/self-heal */
  rawHtml?: string
  /** Which strategy produced this item */
  strategyUsed: string
  /** Confidence score 0-1 */
  confidence: number
}

export interface ExtractionStrategy {
  name: string
  priority: number
  /** Quick check if this strategy can find items on the page */
  canHandle(page: Page, containerSelector?: string): Promise<boolean>
  /** Find all item containers on the page */
  findItems(page: Page, containerSelector?: string): Promise<Locator[] | null>
  /** Extract structured data from a single item */
  extractItem(item: Locator): Promise<ExtractedItem | null>
}

export interface SectionInterpreter<T> {
  sectionName: string
  /** URL path segment for this section's detail page */
  urlPath: string
  /** Convert extracted item into domain object */
  interpret(item: ExtractedItem): T | null
  /** Validate the interpreted result */
  validate(item: T): boolean
}

export interface PipelineDiagnostics {
  strategiesAttempted: string[]
  strategiesFailed: string[]
  strategyUsed: string | null
  itemsFound: number
  itemsParsed: number
  itemsFailed: number
  durationMs: number
  capturedHtml?: string
}

export interface PipelineResult<T> {
  items: T[]
  strategy: string
  confidence: number
  diagnostics: PipelineDiagnostics
}

export type HealthStatus = 'healthy' | 'degraded' | 'broken'

export interface HealthReport {
  section: string
  status: HealthStatus
  strategy: string | null
  confidence: number
  itemCount: number
  message: string
}
