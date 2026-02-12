import type { Page } from 'playwright'
import type { ProgressCallback } from '../../callbacks'
import { ScrapingError } from '../../exceptions'
import type { JobData } from '../../models'
import { createJob } from '../../models'
import { log } from '../../utils/logger'
import { ensureLoggedIn, navigateAndWait, waitAndFocus } from '../utils'
import { JobDomExtractorToggleSchema, type JobDomExtractorToggles } from './config'
import { getJobDescription } from './description'
import { getJobDetails } from './details'
import { extractJobTopCardFromPage } from './top-card'

export type { JobSearchEntry, JobSearchResultsOptions } from './search-results'
export { collectVisibleEntriesFromPage, scrapeJobSearchResults } from './search-results'

export interface JobScraperOptions {
  callback?: ProgressCallback
  domExtractors?: Partial<JobDomExtractorToggles>
  requireLogin?: boolean
}

function resolveDomExtractors(options?: JobScraperOptions): JobDomExtractorToggles {
  const defaults = JobDomExtractorToggleSchema.parse({})
  return JobDomExtractorToggleSchema.parse({
    ...defaults,
    ...options?.domExtractors,
  })
}

function formatSelectedExtractors(domExtractors: JobDomExtractorToggles): string {
  const selected: string[] = []
  if (domExtractors.summary) selected.push('summary')
  if (domExtractors.description) selected.push('description')
  if (domExtractors.details) selected.push('details')
  return selected.join(', ')
}

/**
 * Scrapes a LinkedIn job posting page.
 */
export async function scrapeJob(page: Page, linkedinUrl: string, options?: JobScraperOptions): Promise<JobData> {
  const callback = options?.callback
  const domExtractors = resolveDomExtractors(options)
  const selectedExtractors = formatSelectedExtractors(domExtractors)

  await callback?.onStart('job', linkedinUrl)
  await callback?.onInfo(`Selected sections: ${selectedExtractors || 'none'}`)
  log.info(`Selected sections: ${selectedExtractors || 'none'}`)

  try {
    await navigateAndWait(page, linkedinUrl, callback)
    await page.waitForSelector('main', { timeout: 10000 })
    await waitAndFocus(page, 1)

    if (options?.requireLogin ?? true) {
      await ensureLoggedIn(page)
    }

    const topCard = domExtractors.summary ? await extractJobTopCardFromPage(page) : null
    const description = domExtractors.description ? await getJobDescription(page) : null
    const details = domExtractors.details ? await getJobDetails(page) : null

    const jobIdFromUrl = extractJobIdFromUrl(linkedinUrl)

    const job = createJob({
      linkedinUrl,
      jobId: topCard?.jobId ?? jobIdFromUrl ?? undefined,
      title: topCard?.title ?? undefined,
      companyName: topCard?.companyName ?? undefined,
      companyUrl: topCard?.companyUrl ?? undefined,
      location: topCard?.location ?? undefined,
      workplaceType: topCard?.workplaceType ?? undefined,
      postedAt: topCard?.postedAt ?? undefined,
      applicantCount: topCard?.applicantCount ?? undefined,
      description: description ?? undefined,
      employmentType: details?.employmentType ?? undefined,
      seniorityLevel: details?.seniorityLevel ?? undefined,
      jobFunction: details?.jobFunction ?? undefined,
      industries: details?.industries ?? [],
    })

    await callback?.onComplete('job', job)
    return job
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    await callback?.onError(`Failed to scrape job posting: ${message}`, e instanceof Error ? e : undefined)
    throw new ScrapingError(`Failed to scrape job posting: ${message}`)
  }
}

function extractJobIdFromUrl(url: string): string | null {
  const m = url.match(/\/jobs\/view\/(\d+)/)
  return m?.[1] ?? null
}

export type { JobDomExtractorToggles } from './config'
export { JobDomExtractorToggleSchema } from './config'
