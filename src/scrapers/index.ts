// Functional scraper APIs
export { scrapePerson } from './person'
export type { PersonScraperOptions } from './person'

export { scrapeCompany } from './company'
export type { CompanyScraperOptions } from './company'

export { scrapeJob } from './job'
export type { JobScraperOptions } from './job'

export { searchJobs, JobSearchParamsSchema } from './job_search'
export type { JobSearchParams, JobSearchOptions } from './job_search'

export { scrapeCompanyPosts } from './company_posts'
export type { CompanyPostsScraperOptions } from './company_posts'

// Utility functions for advanced usage
export * from './utils'
