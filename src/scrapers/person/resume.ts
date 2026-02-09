import fs from 'node:fs/promises'
import path from 'node:path'
import type { Locator, Page } from 'playwright'
import { COMMON_SELECTORS } from '../../config/constants'
import { log } from '../../utils/logger'

export interface ResumeDownloadOptions {
  enabled?: boolean
  outputDir?: string
  fileName?: string
  timeoutMs?: number
}

export interface ResumeDownloadResult {
  resumePdfPath?: string
  resumeDownloadLink: string
}

const DEFAULT_OUTPUT_DIR = 'downloads'
const DEFAULT_TIMEOUT_MS = 20000

function shrinkForLog(value: string, maxLength: number = 120): string {
  if (value.length <= maxLength) return value
  const head = Math.floor((maxLength - 3) * 0.75)
  const tail = maxLength - 3 - head
  return `${value.slice(0, head)}...${value.slice(-tail)}`
}

async function firstVisible(locator: Locator): Promise<Locator | null> {
  const count = await locator.count().catch(() => 0)

  for (let index = 0; index < count; index++) {
    const candidate = locator.nth(index)
    if (await candidate.isVisible().catch(() => false)) {
      return candidate
    }
  }

  return null
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function ensurePdfExtension(fileName: string): string {
  return fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`
}

export function buildResumePdfFileName(
  linkedinUrl: string,
  personName?: string,
  requestedFileName?: string,
  suggestedFileName?: string,
): string {
  if (requestedFileName?.trim()) {
    return ensurePdfExtension(sanitizeFileName(requestedFileName.trim()))
  }

  if (personName && personName !== 'Unknown') {
    return ensurePdfExtension(sanitizeFileName(personName.trim()))
  }

  if (suggestedFileName?.trim()) {
    return ensurePdfExtension(sanitizeFileName(suggestedFileName.trim()))
  }

  const profileSlug = linkedinUrl.split('/in/')[1]?.split('/')[0] ?? 'profile'
  return ensurePdfExtension(sanitizeFileName(`linkedin_resume_${profileSlug}`))
}

export async function downloadResumePdf(
  page: Page,
  linkedinUrl: string,
  personName?: string,
  options?: ResumeDownloadOptions,
): Promise<ResumeDownloadResult | null> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const captureTimeoutMs = Math.min(timeoutMs, 10000)
  const shouldSavePdf = options?.enabled === true

  try {
    log.info('Locating top-card More actions button for resume link')

    const moreActionsCandidate = page.locator(COMMON_SELECTORS.PROFILE_MORE_ACTIONS_TRIGGER)
    const moreActions = await firstVisible(moreActionsCandidate)
    if (!moreActions) {
      log.info('Resume link not found: More actions button is not visible')
      return null
    }

    const menuRoot = moreActions.locator('xpath=ancestor::div[contains(@class,"artdeco-dropdown")]').first()
    const saveToPdfInMenu = await firstVisible(menuRoot.locator(COMMON_SELECTORS.PROFILE_SAVE_TO_PDF_ACTION))

    if (!saveToPdfInMenu) {
      await moreActions.click()
    }

    const saveToPdfAction =
      (await firstVisible(menuRoot.locator(COMMON_SELECTORS.PROFILE_SAVE_TO_PDF_ACTION))) ??
      (await firstVisible(page.locator(COMMON_SELECTORS.PROFILE_SAVE_TO_PDF_ACTION)))

    if (!saveToPdfAction) {
      log.info('Resume link not found: Save to PDF action is not visible')
      return null
    }

    log.info('Save to PDF action found, attempting link capture')

    const downloadPromise = page.waitForEvent('download', { timeout: captureTimeoutMs }).catch(() => null)
    const popupPromise = page.waitForEvent('popup', { timeout: captureTimeoutMs }).catch(() => null)
    const responsePromise = page
      .waitForResponse(
        (response) => {
          const contentType = response.headers()['content-type'] ?? ''
          return contentType.toLowerCase().includes('pdf') || /\.pdf([?#].*)?$/i.test(response.url())
        },
        { timeout: captureTimeoutMs },
      )
      .catch(() => null)

    await saveToPdfAction.click()

    const download = await downloadPromise

    if (!download) {
      const popup = await popupPromise
      if (popup) {
        const popupUrl = popup.url()
        if (popupUrl) {
          log.info(`Resume link captured via popup: ${shrinkForLog(popupUrl)}`)
          return {
            resumeDownloadLink: popupUrl,
          }
        }
      }

      const pdfResponse = await responsePromise
      if (pdfResponse) {
        log.info(`Resume link captured via response: ${shrinkForLog(pdfResponse.url())}`)
        return {
          resumeDownloadLink: pdfResponse.url(),
        }
      }

      log.info('Resume link capture did not produce download, popup, or PDF response')
      return null
    }

    const fileName = buildResumePdfFileName(linkedinUrl, personName, options?.fileName, download.suggestedFilename())
    const resumeDownloadLink = download.url()
    log.info(`Resume link captured via download: ${shrinkForLog(resumeDownloadLink)}`)

    if (!shouldSavePdf) {
      try {
        await download.cancel()
      } catch {
        // best-effort cleanup; some browsers may not support cancel reliably
      }

      return {
        resumeDownloadLink,
      }
    }

    const outputDir = path.resolve(options?.outputDir ?? DEFAULT_OUTPUT_DIR)
    const outputPath = path.join(outputDir, fileName)

    await fs.mkdir(outputDir, { recursive: true })
    await download.saveAs(outputPath)
    log.success(`Resume download complete: ${outputPath}`)

    return {
      resumePdfPath: outputPath,
      resumeDownloadLink,
    }
  } catch (e) {
    log.debug(`Could not download generated resume PDF: ${e}`)
    return null
  }
}
