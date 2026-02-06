import type { Page } from 'playwright'
import { AboutPageExtractor } from '../../extraction/page-extractors'
import { log } from '../../utils/logger'
import { getAttributeSafe } from '../utils'
import { extractTopCardFromPage } from './top-card'

export interface TopCardProfileInfo {
  name: string
  location: string | null
  headline: string | null
  origin: string | null
}

export async function getTopCardProfileInfo(
  page: Page,
): Promise<TopCardProfileInfo> {
  try {
    const topCardInfo = await extractTopCardFromPage(page)

    return {
      name: topCardInfo.name,
      location: topCardInfo.origin,
      headline: topCardInfo.headline,
      origin: topCardInfo.origin,
    }
  } catch (e) {
    log.warning(`Error getting name/location: ${e}`)
    return { name: 'Unknown', location: null, headline: null, origin: null }
  }
}

export async function checkOpenToWork(page: Page): Promise<boolean> {
  try {
    const imgTitle = await getAttributeSafe(
      page,
      '.pv-top-card-profile-picture img',
      'title',
      '',
    )
    return imgTitle.toUpperCase().includes('#OPEN_TO_WORK')
  } catch {
    return false
  }
}

export async function getAbout(page: Page): Promise<string | null> {
  try {
    const extractor = new AboutPageExtractor()
    const result = await extractor.extract({
      baseUrl: page.url(),
      page,
    })

    if (result.kind !== 'single') {
      return null
    }

    const root = result.element

    const rootText = await root.textContent()
    const normalizedRootText = rootText?.trim()
    if (normalizedRootText && normalizedRootText.length > 0) {
      if (normalizedRootText.length > 50 || rootText?.includes('\n')) {
        return normalizedRootText
      }
    }

    const textBox = root.locator('[data-testid="expandable-text-box"]').first()
    if ((await textBox.count()) > 0) {
      const text = await textBox.textContent()
      return text ? text.trim() : null
    }

    const aboutSpans = await root.locator('span[aria-hidden="true"]').all()
    if (aboutSpans.length > 1) {
      const aboutText = await aboutSpans[1]?.textContent()
      return aboutText ? aboutText.trim() : null
    }

    return null
  } catch (e) {
    log.debug(`Error getting about section: ${e}`)
    return null
  }
}
