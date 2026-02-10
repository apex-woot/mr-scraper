import type { Locator, Page } from 'playwright'
import { navigateAndWait, scrollPageToBottom, scrollPageToHalf, waitAndFocus } from '../../scrapers/utils'
import { log } from '../../utils/logger'
import { selectorRegistry } from '../registry'

/** Navigate to a detail page and wait for main content */
export async function navigateToSection(
  page: Page,
  baseUrl: string,
  sectionPath: string,
  waitMs?: number,
): Promise<boolean> {
  const normalizedBase = baseUrl.replace(/\/$/, '')
  const normalizedPath = sectionPath.replace(/^\//, '')
  const expectedPath = `/${normalizedPath.replace(/\/$/, '')}`
  const targetUrl = `${normalizedBase}/${normalizedPath}`

  try {
    await navigateAndWait(page, targetUrl)
    await page.waitForSelector('main', { timeout: 10000 })
    await waitAndFocus(page, waitMs ?? 1)

    return page.url().includes(expectedPath)
  } catch (error) {
    log.debug(`navigateToSection failed for ${targetUrl}: ${error}`)
    return false
  }
}

/** Standard scroll sequence: scroll to half, then scroll to bottom */
export async function scrollSection(page: Page, options?: { pauseTime?: number; maxScrolls?: number }): Promise<void> {
  await scrollPageToHalf(page)
  await scrollPageToBottom(page, options?.pauseTime ?? 1, options?.maxScrolls ?? 10)
}

/** Find items using selector registry fallback chain */
export async function findItemsWithFallback(
  page: Page,
  sectionName: string,
  containerSelector?: string,
): Promise<Locator[]> {
  const scope = containerSelector ? page.locator(containerSelector).first() : page.locator('main').first()

  const registeredSelectors = selectorRegistry.getSection(sectionName)?.itemSelectors ?? []

  for (const selector of registeredSelectors) {
    const locators = await filterTopLevelMatches(scope, selector)
    if (locators.length > 0) return locators
  }

  return await filterTopLevelMatches(scope, 'ul > li, ol > li')
}

async function filterTopLevelMatches(scope: Locator, selector: string): Promise<Locator[]> {
  const candidates = scope.locator(selector)

  const topLevelIndexes = await candidates
    .evaluateAll((nodes, cssSelector) => {
      const out: number[] = []

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        if (!(node instanceof Element)) continue

        let parent = node.parentElement
        let isNested = false
        while (parent) {
          if (parent.matches(cssSelector)) {
            isNested = true
            break
          }
          parent = parent.parentElement
        }

        if (!isNested) out.push(i)
      }

      return out
    }, selector)
    .catch((): number[] => [])

  const topLevel: Locator[] = []
  for (const idx of topLevelIndexes) topLevel.push(candidates.nth(idx))
  return topLevel
}

/** Try to find a section on the main profile page by heading text */
export async function findSectionByHeading(page: Page, headingText: string): Promise<Locator | null> {
  const heading = page.locator(`h2:has-text("${headingText}")`).first()

  if ((await heading.count()) === 0) return null

  let section = heading.locator('xpath=ancestor::*[.//ul or .//ol or .//*[@role="tablist"]][1]')

  if ((await section.count()) === 0) section = heading.locator('xpath=ancestor::*[4]')

  if ((await section.count()) === 0) return null

  return section.first()
}

/** Check if a detail page exists (no "Nothing to see" message) */
export async function sectionHasContent(page: Page): Promise<boolean> {
  const nothingToSee = await page.locator('text="Nothing to see for now"').count()
  return nothingToSee === 0
}
