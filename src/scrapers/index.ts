// Functional scraper APIs

export type { JobDomExtractorToggles, JobScraperOptions, JobSearchEntry, JobSearchResultsOptions } from './jobs'
export { collectVisibleEntriesFromPage, JobDomExtractorToggleSchema, scrapeJob, scrapeJobSearchResults } from './jobs'
export type {
  PersonDomExtractorToggles,
  PersonScraperConfig,
  PersonScraperOptions,
  PersonScrapeWithVoyagerOptions,
  PersonScrapeWithVoyagerResult,
  PersonVoyagerCaptureOptions,
  ResumeDownloadOptions,
} from './person'
export {
  PERSON_CORE_SECTIONS_CONFIG,
  PersonDomExtractorToggleSchema,
  PersonScraperConfigSchema,
  scrapePerson,
  scrapePersonWithVoyagerCapture,
} from './person'

// Utility functions for advanced usage
export * from './utils'
