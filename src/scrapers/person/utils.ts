import type { Locator } from 'playwright'
import { DATE_PATTERNS, SCRAPING_CONSTANTS } from '../../config/constants'
import { log } from '../../utils/logger'

/**
 * Extracts unique text content from an element's children.
 * Useful for filtering out duplicate hidden text (e.g. accessibility labels).
 */
export async function extractUniqueTextsFromElement(element: Locator): Promise<string[]> {
  let rawTexts = await element
    .locator('span[aria-hidden="true"], div > span')
    .allTextContents()
    .catch((): string[] => [])

  if (rawTexts.length === 0) {
    rawTexts = await element
      .locator('span, div')
      .allTextContents()
      .catch((): string[] => [])
  }

  const exactSeen = new Set<string>()
  const tokenIndex = new Map<string, string[]>()
  const uniqueTexts: string[] = []

  for (const rawText of rawTexts) {
    const trimmed = rawText.trim()
    if (!trimmed) continue
    if (trimmed.length >= 200) continue
    if (exactSeen.has(trimmed)) continue

    const keys = buildSubstringKeys(trimmed)
    const candidates = new Set<string>()
    for (const key of keys) {
      const bucket = tokenIndex.get(key)
      if (!bucket) continue
      for (const existing of bucket) candidates.add(existing)
    }

    let isSubstringRelated = false
    for (const existing of candidates) {
      if ((existing.length > 3 && trimmed.includes(existing)) || (trimmed.length > 3 && existing.includes(trimmed))) {
        isSubstringRelated = true
        break
      }
    }

    if (isSubstringRelated) continue

    exactSeen.add(trimmed)
    uniqueTexts.push(trimmed)
    for (const key of keys) {
      const bucket = tokenIndex.get(key)
      if (bucket) bucket.push(trimmed)
      else tokenIndex.set(key, [trimmed])
    }
  }

  return uniqueTexts
}

function buildSubstringKeys(text: string): string[] {
  const lower = text.toLowerCase()
  const keys = new Set<string>()

  for (const token of lower.split(/\s+/)) {
    const t = token.replace(/[^a-z0-9]/g, '')
    if (t.length >= 4) keys.add(t)
    if (keys.size >= 6) break
  }

  if (keys.size === 0) keys.add(lower.slice(0, 8))
  return [...keys]
}

export interface DateParseResult {
  fromDate: string | null
  toDate: string | null
  duration?: string | null
}

export function parseDateRange(dateString: string, options: { includeDuration?: boolean } = {}): DateParseResult {
  if (!dateString) {
    const result: DateParseResult = { fromDate: null, toDate: null }
    if (options.includeDuration) result.duration = null
    return result
  }

  try {
    let dateRangePart = dateString
    let duration: string | null = null

    // Extract duration if requested (e.g., "Jan 2020 - Present · 1 yr 2 mos")
    if (options.includeDuration && dateString.includes('·')) {
      const parts = dateString.split('·')
      dateRangePart = parts[0]?.trim() ?? ''
      duration = parts[1]?.trim() ?? null
    }

    // Parse date range (e.g., "Jan 2020 - Present" or "2018 - 2020")
    let fromDate: string | null = null
    let toDate: string | null = null

    if (dateRangePart.includes(' - ')) {
      const dateParts = dateRangePart.split(' - ')
      fromDate = dateParts[0]?.trim() ?? null
      toDate = dateParts[1]?.trim() ?? null

      // Normalize "current" keywords to standard "Present"
      if (toDate) {
        for (const keyword of DATE_PATTERNS.CURRENT_KEYWORDS) {
          if (toDate === keyword || toDate.toLowerCase() === keyword.toLowerCase()) {
            toDate = 'Present'
            break
          }
        }
      }
    } else {
      // Single date (common in education: "2020")
      const singleDate = dateRangePart.trim()
      fromDate = singleDate || null
      // For education (no duration), single year means both from and to
      // For work (with duration), single date means only fromDate
      toDate = options.includeDuration ? null : singleDate || null
    }

    const result: DateParseResult = { fromDate, toDate }
    if (options.includeDuration) result.duration = duration
    return result
  } catch (e) {
    log.debug(`Error parsing date range '${dateString}': ${e}`)
    const result: DateParseResult = { fromDate: null, toDate: null }
    if (options.includeDuration) result.duration = null
    return result
  }
}

export function mapInterestTabToCategory(tabName: string): string {
  const tabLower = tabName.toLowerCase()
  if (tabLower.includes('compan')) return 'company'
  if (tabLower.includes('group')) return 'group'
  if (tabLower.includes('school')) return 'school'
  if (tabLower.includes('newsletter')) return 'newsletter'
  if (tabLower.includes('voice') || tabLower.includes('influencer')) return 'influencer'
  return tabLower
}

export function mapContactHeadingToType(heading: string): string | null {
  const lower = heading.toLowerCase()
  if (lower.includes('profile')) return 'linkedin'
  if (lower.includes('website')) return 'website'
  if (lower.includes('email')) return 'email'
  if (lower.includes('phone')) return 'phone'
  if (lower.includes('twitter') || lower.includes('x.com')) return 'twitter'
  if (lower.includes('birthday')) return 'birthday'
  if (lower.includes('address')) return 'address'
  return null
}

/**
 * Normalizes extracted lines to stable text suitable for raw fields.
 */
export function normalizePlainTextLines(lines: Array<string | null | undefined>): string[] {
  const normalized = lines
    .map((line) => (line ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => !isNoiseLine(line))

  const deduped: string[] = []
  for (const line of normalized) {
    if (deduped[deduped.length - 1] !== line) deduped.push(line)
  }

  return deduped
}

export function toPlainText(lines: Array<string | null | undefined>): string | undefined {
  const normalized = normalizePlainTextLines(lines)
  if (normalized.length === 0) return undefined
  return normalized.join('\n')
}

function isNoiseLine(line: string): boolean {
  const lower = line.toLowerCase()
  if (lower === 'see patent' || lower === 'show patent' || lower === 'other inventors') {
    return true
  }

  return line.startsWith('+') || /^[+\d\s]+$/.test(line)
}

/**
 * Determines if a text string looks like a date line (with dates, duration, or "Present").
 * Used to differentiate date lines from location or description text.
 */
export function isDateLine(text: string): boolean {
  const hasDateSeparator = text.includes(DATE_PATTERNS.DATE_RANGE_SEPARATOR)
  const hasCurrentKeyword = DATE_PATTERNS.CURRENT_KEYWORDS.some((kw) => text.includes(kw))
  const hasDuration = DATE_PATTERNS.DURATION_REGEX.test(text)
  const hasYear = DATE_PATTERNS.YEAR_REGEX.test(text)
  return (hasDateSeparator || hasCurrentKeyword) && (hasDuration || hasYear)
}

/**
 * Determines if a text string looks like a location (short, no numbers, no duration separator).
 */
export function isLocationLike(text: string): boolean {
  return (
    text.length < SCRAPING_CONSTANTS.MAX_LOCATION_LENGTH &&
    !text.includes(DATE_PATTERNS.DURATION_SEPARATOR) &&
    !/\d/.test(text) &&
    text.split(/\s+/).length <= SCRAPING_CONSTANTS.MAX_LOCATION_WORD_COUNT
  )
}

/**
 * Determines if a text string looks like a description (long text with many words).
 */
export function isDescriptionLike(text: string): boolean {
  return (
    text.split(/\s+/).length > SCRAPING_CONSTANTS.MIN_DESCRIPTION_WORD_COUNT ||
    text.length > SCRAPING_CONSTANTS.MIN_DESCRIPTION_LENGTH
  )
}
