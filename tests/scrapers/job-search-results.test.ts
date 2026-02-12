import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import type { Page } from 'playwright'
import { chromium } from 'playwright'
import { BrowserManager } from '../../src/browser'
import { scrapeJobSearchResults } from '../../src/scrapers'

const canRunPlaywright = existsSync(chromium.executablePath())
const describeJobSearch = canRunPlaywright ? describe : describe.skip

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

describeJobSearch('Job search results scraper', () => {
  let browserManager: BrowserManager

  beforeAll(async () => {
    browserManager = new BrowserManager({ headless: true })
    await browserManager.start()
  })

  afterAll(async () => {
    await browserManager.close()
  })

  test('scrapeJobSearchResults collects entries without class selectors', async () => {
    const page = browserManager.page

    await routePages(page, {
      '/jobs/search/': `
        <main>
          <ul>
            <li data-occludable-job-id="111">
              <a href="/jobs/view/111/?trk=example">Staff Software Engineer</a>
              <div><span>Example Company</span></div>
              <div><span>Example City, Example State (Hybrid)</span></div>
              <div><time datetime="2026-02-10">6 minutes ago</time></div>
            </li>

            <li data-occludable-job-id="222">
              <a href="/jobs/view/222/?trk=example">System Administrator</a>
              <div><span>Example Co</span></div>
              <div><span>Example City, Example State (On-site)</span></div>
              <div><span>Viewed</span></div>
              <div><span>Easy Apply</span></div>
            </li>

            <li data-occludable-job-id="333"></li>
          </ul>
        </main>
      `,
    })

    const results = await scrapeJobSearchResults(
      page,
      'https://www.linkedin.com/jobs/search/?currentJobId=111&sortBy=DD',
      {
        requireLogin: false,
        scrollPasses: 1,
        maxJobs: 10,
        scrollPauseMs: 0,
      },
    )

    expect(results).toHaveLength(2)

    expect(results[0]).toMatchObject({
      linkedinUrl: 'https://www.linkedin.com/jobs/view/111/',
      jobId: '111',
      title: 'Staff Software Engineer',
      companyName: 'Example Company',
      location: 'Example City, Example State',
      workplaceType: 'Hybrid',
      postedAt: '6 minutes ago',
    })

    expect(results[1]).toMatchObject({
      linkedinUrl: 'https://www.linkedin.com/jobs/view/222/',
      jobId: '222',
      title: 'System Administrator',
      companyName: 'Example Co',
      location: 'Example City, Example State',
      workplaceType: 'On-site',
    })
    expect(results[1]?.postedAt).toBeNull()
  })
})
