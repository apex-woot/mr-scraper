import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import type { Page } from 'playwright'
import { chromium } from 'playwright'
import { BrowserManager } from '../../src/browser'
import { scrapeJob } from '../../src/scrapers'

const canRunPlaywright = existsSync(chromium.executablePath())
const describeJobScraper = canRunPlaywright ? describe : describe.skip

function html(body: string): string {
  return `<!doctype html><html><body>${body}</body></html>`
}

async function routePages(page: Page, pagesByPath: Record<string, string>) {
  await page.unroute('**/*').catch(() => {})
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    const body = pagesByPath[url.pathname] ?? '<main></main>'
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: html(body),
    })
  })
}

describeJobScraper('Job scraper', () => {
  let browserManager: BrowserManager

  beforeAll(async () => {
    browserManager = new BrowserManager({ headless: true })
    await browserManager.start()
  })

  afterAll(async () => {
    await browserManager.close()
  })

  test('scrapeJob returns merged top-card/details/description fields', async () => {
    const page = browserManager.page

    await routePages(page, {
      '/jobs/view/1234567890/': `
        <main>
          <section data-testid="job-details-top-card">
            <h1>Staff Software Engineer</h1>
            <a href="https://www.linkedin.com/company/example-company/">Example Company</a>
            <div><span>Example City, Example State, United States (Hybrid)</span></div>
            <div><span>Reposted 3 days ago · 42 applicants</span></div>
          </section>

          <section>
            <h2>Job details</h2>
            <div>
              <span>Employment type</span><span>Full-time</span>
              <span>Seniority level</span><span>Mid-Senior level</span>
              <span>Job function</span><span>Engineering</span>
              <span>Industries</span><span>Software Development, Internet</span>
            </div>
          </section>

          <section id="job-details">
            <h2>About the job</h2>
            <div data-testid="expandable-text-box">We build resilient systems.</div>
          </section>
        </main>
      `,
    })

    const url = 'https://www.linkedin.com/jobs/view/1234567890/'
    const job = await scrapeJob(page, url, { requireLogin: false })

    expect(job).toEqual({
      linkedinUrl: url,
      jobId: '1234567890',
      title: 'Staff Software Engineer',
      companyName: 'Example Company',
      companyUrl: 'https://www.linkedin.com/company/example-company/',
      location: 'Example City, Example State, United States',
      workplaceType: 'Hybrid',
      postedAt: 'Reposted 3 days ago',
      applicantCount: 42,
      description: 'We build resilient systems.',
      employmentType: 'Full-time',
      seniorityLevel: 'Mid-Senior level',
      jobFunction: 'Engineering',
      industries: ['Software Development', 'Internet'],
    })
  })
})
