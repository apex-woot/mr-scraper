import type { Page } from 'playwright'
import type { ProgressCallback } from '../../callbacks'
import { ScrapingError } from '../../exceptions'
import type { PersonData } from '../../models'
import { createPerson } from '../../models'
import {
  createVoyagerRequestRecorder,
  createVoyagerSessionRecorder,
  type VoyagerReplaySession,
  type VoyagerRequestSnapshot,
} from '../../session'
import { log } from '../../utils/logger'
import { ensureLoggedIn, navigateAndWait, scrollPageToBottom, scrollPageToHalf, waitAndFocus } from '../utils'
import { getAccomplishments } from './accomplishments'
import { deduplicateItems } from './common-patterns'
import { PersonDomExtractorToggleSchema, type PersonDomExtractorToggles } from './config'
import { getContactInfo } from './contact-info'
import { getEducations } from './educations'
import { getExperiences } from './experiences'
import { getInterests } from './interests'
import { getPatents } from './patents'
import { checkOpenToWork, getAbout, getTopCardProfileInfo } from './profile'
import { getPublications } from './publications'
import { downloadResumePdf, type ResumeDownloadOptions } from './resume'

export interface PersonScraperOptions {
  callback?: ProgressCallback
  raw?: boolean
  domExtractors?: Partial<PersonDomExtractorToggles>
  resume?: ResumeDownloadOptions
  sections?: {
    about?: boolean
    experiences?: boolean
    educations?: boolean
    patents?: boolean
    interests?: boolean
    accomplishments?: boolean
    contacts?: boolean
  }
}

export interface PersonVoyagerCaptureOptions {
  session?: {
    enabled?: boolean
    timeoutMs?: number
    redactLogs?: boolean
  }
  requests?: {
    enabled?: boolean
    dedupe?: boolean
    maxRequests?: number
    includeHeaders?: readonly string[]
  }
}

export interface PersonScrapeWithVoyagerOptions extends PersonScraperOptions {
  voyagerCapture?: PersonVoyagerCaptureOptions
}

export interface PersonScrapeWithVoyagerResult {
  person: PersonData
  voyagerSession?: VoyagerReplaySession
  voyagerRequests?: VoyagerRequestSnapshot[]
}

function resolveDomExtractors(options?: PersonScraperOptions): PersonDomExtractorToggles {
  const defaults = PersonDomExtractorToggleSchema.parse({})

  if (!options?.sections) {
    return PersonDomExtractorToggleSchema.parse({
      ...defaults,
      ...options?.domExtractors,
    })
  }

  const legacySections = options.sections
  return PersonDomExtractorToggleSchema.parse({
    ...defaults,
    ...options.domExtractors,
    about: legacySections.about ?? defaults.about,
    experiences: legacySections.experiences ?? defaults.experiences,
    educations: legacySections.educations ?? defaults.educations,
    patents: legacySections.patents ?? defaults.patents,
    interests: legacySections.interests ?? defaults.interests,
    accomplishments: legacySections.accomplishments ?? defaults.accomplishments,
    contacts: legacySections.contacts ?? defaults.contacts,
  })
}

function formatSelectedExtractors(domExtractors: PersonDomExtractorToggles): string {
  const selected: string[] = []
  if (domExtractors.summary) selected.push('summary')
  if (domExtractors.about) selected.push('about')
  if (domExtractors.contacts) selected.push('contact info')
  if (domExtractors.educations) selected.push('education')
  if (domExtractors.experiences) selected.push('experience')
  if (domExtractors.patents) selected.push('patents')
  if (domExtractors.publications) selected.push('publications')
  if (domExtractors.interests) selected.push('interests')
  if (domExtractors.accomplishments) selected.push('accomplishments')

  return selected.join(', ')
}

/**
 * Scrapes a LinkedIn person profile.
 */
export async function scrapePerson(
  page: Page,
  linkedinUrl: string,
  options?: PersonScraperOptions,
): Promise<PersonData> {
  const callback = options?.callback
  const domExtractors = resolveDomExtractors(options)
  const selectedExtractors = formatSelectedExtractors(domExtractors)

  await callback?.onStart('person', linkedinUrl)
  await callback?.onInfo(`Selected sections: ${selectedExtractors || 'none'}`)
  log.info(`Selected sections: ${selectedExtractors || 'none'}`)

  try {
    await navigateAndWait(page, linkedinUrl, callback)
    log.debug('Navigated to profile')

    await ensureLoggedIn(page)

    await page.waitForSelector('main', { timeout: 10000 })
    await waitAndFocus(page, 1)

    const topCard = domExtractors.summary
      ? await getTopCardProfileInfo(page)
      : { name: undefined, location: null, headline: null, currentPosition: null, origin: null }
    if (domExtractors.summary && topCard.name) log.debug(`Got name: ${topCard.name}`)

    const openToWork = domExtractors.summary ? await checkOpenToWork(page) : false

    const about = domExtractors.about ? await getAbout(page) : null
    if (domExtractors.about) log.debug('Got about section')

    const resumeDownload = await downloadResumePdf(page, linkedinUrl, topCard.name, options?.resume)
    if (resumeDownload) {
      log.debug(`Captured generated resume download link: ${resumeDownload.resumeDownloadLink}`)
      await callback?.onInfo(`Captured generated resume download link: ${resumeDownload.resumeDownloadLink}`)
      if (resumeDownload.resumePdfPath) {
        log.debug(`Downloaded generated resume PDF to: ${resumeDownload.resumePdfPath}`)
        await callback?.onInfo(`Downloaded generated resume PDF to: ${resumeDownload.resumePdfPath}`)
      }
    }

    const publications = domExtractors.publications
      ? await getPublications(page, linkedinUrl, options?.raw === true)
      : []
    if (domExtractors.publications) log.debug(`Got ${publications.length} publications`)

    if (domExtractors.experiences || domExtractors.educations) {
      await scrollPageToHalf(page)
      await scrollPageToBottom(page, 0.5, 3)
    }

    const experiences = domExtractors.experiences ? await getExperiences(page, linkedinUrl, options?.raw === true) : []
    if (domExtractors.experiences) log.debug(`Got ${experiences.length} experiences`)

    const educations = domExtractors.educations ? await getEducations(page, linkedinUrl, options?.raw === true) : []
    if (domExtractors.educations) log.debug(`Got ${educations.length} educations`)

    const patents = domExtractors.patents ? await getPatents(page, linkedinUrl, options?.raw === true) : []
    if (domExtractors.patents) log.debug(`Got ${patents.length} patents`)

    const interests = domExtractors.interests ? await getInterests(page, linkedinUrl, options?.raw === true) : []
    if (domExtractors.interests) log.debug(`Got ${interests.length} interests`)

    const accomplishments = domExtractors.accomplishments
      ? await getAccomplishments(page, linkedinUrl, options?.raw === true)
      : []
    if (domExtractors.accomplishments) log.debug(`Got ${accomplishments.length} accomplishments`)

    const combinedAccomplishments = deduplicateItems(
      [...accomplishments, ...publications],
      (item) => `${item.category}|${item.title}`,
    )

    const contacts = domExtractors.contacts ? await getContactInfo(page, linkedinUrl) : []
    if (domExtractors.contacts) log.debug(`Got ${contacts.length} contacts`)

    const person = createPerson({
      linkedinUrl,
      name: topCard.name,
      location: topCard.origin ?? topCard.location ?? undefined,
      headline: topCard.headline ?? undefined,
      currentPosition: topCard.currentPosition ?? undefined,
      origin: topCard.origin ?? undefined,
      about: about ?? undefined,
      openToWork,
      experiences,
      educations,
      patents,
      interests,
      accomplishments: combinedAccomplishments,
      contacts,
      resumePdfPath: resumeDownload?.resumePdfPath,
      resumeDownloadLink: resumeDownload?.resumeDownloadLink,
    } as PersonData)

    log.debug('Scraping complete')
    await callback?.onComplete('person', person)

    return person
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    await callback?.onError(`Failed to scrape person profile: ${message}`, e instanceof Error ? e : undefined)
    throw new ScrapingError(`Failed to scrape person profile: ${message}`)
  }
}

/**
 * Wrapper around scrapePerson that records Voyager request metadata during the scrape.
 * This is best-effort and never fails the scrape if capture times out.
 */
export async function scrapePersonWithVoyagerCapture(
  page: Page,
  linkedinUrl: string,
  options: PersonScrapeWithVoyagerOptions = {},
): Promise<PersonScrapeWithVoyagerResult> {
  const { voyagerCapture, ...scrapeOptions } = options

  const sessionEnabled = voyagerCapture?.session?.enabled ?? true
  const requestsEnabled = voyagerCapture?.requests?.enabled ?? true

  const sessionRecorder = sessionEnabled
    ? createVoyagerSessionRecorder(page, {
        matchers: ['/voyager/api/'],
        autoStop: true,
        redactLogs: voyagerCapture?.session?.redactLogs ?? true,
      })
    : undefined

  const requestRecorder = requestsEnabled
    ? createVoyagerRequestRecorder(page, {
        matchers: ['/voyager/api/'],
        dedupe: voyagerCapture?.requests?.dedupe ?? true,
        maxRequests: voyagerCapture?.requests?.maxRequests ?? 200,
        includeHeaders: voyagerCapture?.requests?.includeHeaders,
      })
    : undefined

  sessionRecorder?.start()
  requestRecorder?.start()

  const sessionPromise = sessionRecorder?.waitForSession({ timeoutMs: voyagerCapture?.session?.timeoutMs ?? 45000 })

  try {
    const person = await scrapePerson(page, linkedinUrl, scrapeOptions)

    const voyagerSession = sessionPromise ? await sessionPromise.catch(() => undefined) : undefined

    const voyagerRequests = requestRecorder ? [...requestRecorder.getRequests()] : undefined

    return {
      person,
      voyagerSession,
      voyagerRequests,
    }
  } finally {
    sessionRecorder?.stop()
    requestRecorder?.stop()
  }
}

export type { PersonDomExtractorToggles, PersonScraperConfig } from './config'
export {
  PERSON_CORE_SECTIONS_CONFIG,
  PersonDomExtractorToggleSchema,
  PersonScraperConfigSchema,
} from './config'
export type { ResumeDownloadOptions } from './resume'
