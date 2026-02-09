// Functional scraper APIs

export type { PersonDomExtractorToggles, PersonScraperConfig, PersonScraperOptions } from './person'
export {
  PERSON_CORE_SECTIONS_CONFIG,
  PersonDomExtractorToggleSchema,
  PersonScraperConfigSchema,
  scrapePerson,
} from './person'

// Utility functions for advanced usage
export * from './utils'
