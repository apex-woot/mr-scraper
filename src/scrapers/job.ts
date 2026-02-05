import type { Page } from 'playwright'
import type { ProgressCallback } from '../callbacks'
import type { JobData } from '../models/job'
import { createJob } from '../models/job'
import { log } from '../utils/logger'
import { checkRateLimit, navigateAndWait } from './utils'

export interface JobScraperOptions {
  callback?: ProgressCallback
}

/**
 * Scrapes job data from a LinkedIn job URL.
 */
export async function scrapeJob(
  page: Page,
  linkedinUrl: string,
  options?: JobScraperOptions,
): Promise<JobData> {
  const callback = options?.callback

  await callback?.onStart('Job', linkedinUrl)

  await navigateAndWait(page, linkedinUrl, callback)
  log.debug('Navigated to job page')

  await checkRateLimit(page)

  const jobTitle = await getJobTitle(page)
  log.debug(`Got job title: ${jobTitle ?? 'Unknown'}`)

  const company = await getCompany(page)
  log.debug('Got company name')

  const location = await getLocation(page)
  log.debug('Got location')

  const postedDate = await getPostedDate(page)
  log.debug('Got posted date')

  const applicantCount = await getApplicantCount(page)
  log.debug('Got applicant count')

  const jobDescription = await getDescription(page)
  log.debug('Got job description')

  const companyUrl = await getCompanyUrl(page)
  log.debug('Got company URL')

  const job = createJob({
    linkedinUrl,
    jobTitle: jobTitle ?? undefined,
    company: company ?? undefined,
    companyLinkedinUrl: companyUrl ?? undefined,
    location: location ?? undefined,
    postedDate: postedDate ?? undefined,
    applicantCount: applicantCount ?? undefined,
    jobDescription: jobDescription ?? undefined,
  } as JobData)

  log.debug('Scraping complete')
  await callback?.onComplete('Job', job)

  return job
}

async function getJobTitle(page: Page): Promise<string | null> {
  try {
    const titleElem = page.locator('h1').first()
    const title = await titleElem.innerText()
    return title.trim() || null
  } catch {
    return null
  }
}

async function getCompany(page: Page): Promise<string | null> {
  try {
    const companyLinks = await page.locator('a[href*="/company/"]').all()
    for (const link of companyLinks) {
      const text = (await link.innerText()).trim()
      if (text && text.length > 1 && !text.toLowerCase().startsWith('logo'))
        return text
    }
  } catch {}
  return null
}

async function getCompanyUrl(page: Page): Promise<string | null> {
  try {
    const companyLink = page.locator('a[href*="/company/"]').first()
    if ((await companyLink.count()) > 0) {
      let href = await companyLink.getAttribute('href')
      if (href) {
        if (href.includes('?')) href = href.split('?')[0]!
        if (!href.startsWith('http')) href = `https://www.linkedin.com${href}`
        return href
      }
    }
  } catch {}
  return null
}

async function getLocation(page: Page): Promise<string | null> {
  try {
    const jobPanel = page.locator('h1').first().locator('xpath=ancestor::*[5]')
    if ((await jobPanel.count()) > 0) {
      const textElements = await jobPanel.locator('span, div').all()
      for (const elem of textElements) {
        const text = (await elem.innerText()).trim()
        if (
          text &&
          (text.includes(',') ||
            text.includes('Remote') ||
            text.includes('United States'))
        ) {
          if (text.length > 3 && text.length < 100 && !text.startsWith('$'))
            return text
        }
      }
    }
  } catch {}
  return null
}

async function getPostedDate(page: Page): Promise<string | null> {
  try {
    const textElements = await page.locator('span, div').all()
    for (const elem of textElements) {
      const text = (await elem.innerText()).trim()
      const lower = text.toLowerCase()
      if (
        text &&
        (lower.includes('ago') ||
          lower.includes('day') ||
          lower.includes('week') ||
          lower.includes('hour'))
      ) {
        if (text.length < 50) return text
      }
    }
  } catch {}
  return null
}

async function getApplicantCount(page: Page): Promise<string | null> {
  try {
    const mainContent = page.locator('main').first()
    if ((await mainContent.count()) > 0) {
      const textElements = await mainContent.locator('span, div').all()
      for (const elem of textElements) {
        const text = (await elem.innerText()).trim()
        if (text && text.length < 50) {
          const lower = text.toLowerCase()
          if (
            lower.includes('applicant') ||
            lower.includes('people clicked') ||
            lower.includes('applied')
          )
            return text
        }
      }
    }
  } catch {}
  return null
}

async function getDescription(page: Page): Promise<string | null> {
  try {
    const aboutHeading = page.locator('h2:has-text("About the job")').first()
    if ((await aboutHeading.count()) > 0) {
      const article = aboutHeading.locator('xpath=ancestor::article[1]')
      if ((await article.count()) > 0) {
        const description = await article.innerText()
        return description.trim() || null
      }
    }

    const article = page.locator('article').first()
    if ((await article.count()) > 0) {
      const description = await article.innerText()
      return description.trim() || null
    }
  } catch {}
  return null
}
