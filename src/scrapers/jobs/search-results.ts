import type { Page } from 'playwright'
import { JobTopCardParser, type JobTopCardResult } from '../../extraction/parsers'
import { log } from '../../utils/logger'
import { ensureLoggedIn, navigateAndWait, waitAndFocus } from '../utils'

export interface JobSearchEntry extends JobTopCardResult {
  linkedinUrl: string
}

export interface JobSearchResultsOptions {
  /** Max distinct jobs to return. */
  maxJobs?: number
  /** Number of scroll passes to attempt. */
  scrollPasses?: number
  /** Delay between scroll passes. */
  scrollPauseMs?: number
  /** Defaults to true. */
  requireLogin?: boolean
}

const LINKEDIN_ORIGIN = 'https://www.linkedin.com'

/**
 * Scrape job *search result entries* (list cards) from a LinkedIn jobs search page.
 *
 * This intentionally avoids brittle class selectors; it keys off stable invariants:
 * - `li[data-occludable-job-id]` list items
 * - anchors with `href` containing `/jobs/view/`.
 */
export async function scrapeJobSearchResults(
  page: Page,
  searchUrl: string,
  options: JobSearchResultsOptions = {},
): Promise<JobSearchEntry[]> {
  const maxJobs = clampInt(options.maxJobs ?? 20, 1, 200)
  const scrollPasses = clampInt(options.scrollPasses ?? 10, 1, 60)
  const scrollPauseMs = clampInt(options.scrollPauseMs ?? 900, 0, 10_000)

  await navigateAndWait(page, searchUrl)
  await page.waitForSelector('main', { timeout: 15000 })
  await waitAndFocus(page, 1)

  if (options.requireLogin ?? true) {
    await ensureLoggedIn(page)
  }

  const collected = new Map<string, JobSearchEntry>()
  const parser = new JobTopCardParser()

  for (let pass = 0; pass < scrollPasses && collected.size < maxJobs; pass++) {
    const batch = await collectVisibleEntriesFromPageWithParser(page, parser)
    for (const entry of batch) {
      const key = entry.jobId ?? entry.linkedinUrl
      if (!collected.has(key)) collected.set(key, entry)
      if (collected.size >= maxJobs) break
    }

    const didScroll = await scrollResultsListToBottom(page)
    if (!didScroll) {
      // Fall back to page scroll; best-effort in case LinkedIn changes to window scrolling.
      await page.mouse.wheel(0, 1600)
    }

    if (scrollPauseMs > 0) await page.waitForTimeout(scrollPauseMs)
  }

  return [...collected.values()].slice(0, maxJobs)
}

export async function collectVisibleEntriesFromPage(page: Page): Promise<JobSearchEntry[]> {
  const parser = new JobTopCardParser()
  return collectVisibleEntriesFromPageWithParser(page, parser)
}

async function collectVisibleEntriesFromPageWithParser(
  page: Page,
  parser: JobTopCardParser,
): Promise<JobSearchEntry[]> {
  const raw = await page
    .locator('li[data-occludable-job-id]')
    .evaluateAll((nodes) => {
      const items: Array<{ jobIdAttr: string | null; href: string | null; text: string }> = []

      for (const node of nodes) {
        if (!(node instanceof HTMLElement)) continue

        const jobIdAttr = node.getAttribute('data-occludable-job-id')
        const anchor = node.querySelector('a[href*="/jobs/view/"]')
        const href = anchor?.getAttribute('href')
        if (!href) continue

        const text = (node.innerText ?? '').trim()
        // Skip occluded placeholders that have the job id but no rendered text.
        if (!text) continue

        items.push({ jobIdAttr, href, text })
      }

      return items
    })
    .catch((): Array<{ jobIdAttr: string | null; href: string | null; text: string }> => [])

  const entries: JobSearchEntry[] = []

  for (const item of raw) {
    const href = item.href ?? ''
    const linkedinUrl = normalizeJobViewUrl(href)
    if (!linkedinUrl) continue

    const texts = normalizeLines(item.text)
    const parsed = parser.parse({
      texts,
      links: [{ url: linkedinUrl, text: 'Job', isExternal: true }],
      context: { url: linkedinUrl },
    })

    if (!parsed || !parser.validate(parsed)) continue

    // Prefer the stable attribute when available.
    const jobId = item.jobIdAttr?.trim() || parsed.jobId

    entries.push({
      ...parsed,
      jobId,
      linkedinUrl,
    })
  }

  return entries
}

function normalizeJobViewUrl(href: string): string | null {
  try {
    const url = new URL(href, LINKEDIN_ORIGIN)
    if (!url.pathname.startsWith('/jobs/view/')) return null

    // Keep canonical form; drop query params.
    const canonical = `https://www.linkedin.com${url.pathname}`
    return canonical.replace(/\/+$/, '/')
  } catch {
    return null
  }
}

function normalizeLines(rawText: string): string[] {
  const lines = rawText
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const out: string[] = []
  for (const line of lines) {
    if (out[out.length - 1] !== line) out.push(line)
  }

  return out
}

async function scrollResultsListToBottom(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const firstItem = document.querySelector('li[data-occludable-job-id]')
      if (!firstItem) return false

      const ul = firstItem.closest('ul')
      if (!ul) return false

      const isScrollable = (el: Element): el is HTMLElement => {
        if (!(el instanceof HTMLElement)) return false
        const style = window.getComputedStyle(el)
        const overflowY = style.overflowY
        const canScroll = overflowY === 'auto' || overflowY === 'scroll'
        return canScroll && el.scrollHeight - el.clientHeight > 40
      }

      let current: Element | null = ul
      while (current) {
        if (isScrollable(current)) {
          current.scrollTop = current.scrollHeight
          return true
        }
        current = current.parentElement
      }

      return false
    })
  } catch (e) {
    log.debug(`scrollResultsListToBottom failed: ${e}`)
    return false
  }
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  const v = Math.trunc(value)
  if (v < min) return min
  if (v > max) return max
  return v
}
