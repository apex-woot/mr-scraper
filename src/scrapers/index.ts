// Functional scraper APIs

export type { CompanyScraperOptions } from './company'
export { scrapeCompany } from './company'
export type { CompanyPostsScraperOptions } from './company_posts'
export { scrapeCompanyPosts } from './company_posts'
export type { JobScraperOptions } from './job'
export { scrapeJob } from './job'
export type { JobSearchOptions, JobSearchParams } from './job_search'
export { JobSearchParamsSchema, searchJobs } from './job_search'
export type { PersonScraperOptions } from './person'
export { scrapePerson } from './person'

// Utility functions for advanced usage
export * from './utils'
