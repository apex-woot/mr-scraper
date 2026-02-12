import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { chromium, type Page } from 'playwright'
import { BrowserManager } from '../../browser'
import type { ProgressCallback } from '../../callbacks'
import { scrapePerson } from './index'

const canRunPlaywright = existsSync(chromium.executablePath())
const describePersonScraper = canRunPlaywright ? describe : describe.skip

const PROFILE_FIXTURE_HTML = `
<!doctype html>
<html>
  <body>
    <nav>
      <a href="/feed">Home</a>
    </nav>
    <main>
      <section class="artdeco-card" data-member-id="10000001">
        <div class="mt2 relative">
          <div>
            <div>
              <a aria-label="Jordan Vale">
                <h1 class="inline t-24">Jordan Vale</h1>
              </a>
            </div>
            <div class="text-body-medium break-words">Product Research Lead</div>
          </div>
          <div class="mt2">
            <span class="text-body-small inline t-black--light break-words">Riverton, Colorado, United States</span>
            <span class="t-black--light"><a id="top-card-text-details-contact-info">Contact info</a></span>
          </div>
        </div>
      </section>
    </main>
  </body>
</html>
`

async function mockProfileDocument(page: Page, profileUrl: string): Promise<void> {
  await page.route(profileUrl, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: PROFILE_FIXTURE_HTML,
    })
  })
}

describePersonScraper('scrapePerson orchestration', () => {
  let browserManager: BrowserManager

  beforeAll(async () => {
    browserManager = new BrowserManager({ headless: true })
    await browserManager.start()
  })

  afterAll(async () => {
    await browserManager.close()
  })

  test('returns a valid person result when scraping summary-only mode', async () => {
    const page = browserManager.page
    const profileUrl = 'https://www.linkedin.com/in/sample-user-summary/'
    await mockProfileDocument(page, profileUrl)

    const person = await scrapePerson(page, profileUrl, {
      domExtractors: {
        summary: true,
        about: false,
        contacts: false,
        educations: false,
        experiences: false,
        patents: false,
        publications: false,
        interests: false,
        accomplishments: false,
      },
      resume: { timeoutMs: 100 },
    })

    expect(person.linkedinUrl).toBe(profileUrl)
    expect(person.name).toBe('Jordan Vale')
    expect(person.currentPosition).toBe('Product Research Lead')
    expect(person.location).toContain('Colorado')
    expect(person.experiences).toEqual([])
    expect(person.educations).toEqual([])
    expect(person.contacts).toEqual([])
  })

  test('supports legacy sections toggles and emits lifecycle callback events', async () => {
    const page = browserManager.page
    const profileUrl = 'https://www.linkedin.com/in/sample-user-legacy/'
    await mockProfileDocument(page, profileUrl)

    const infoMessages: string[] = []
    const callbackEvents: string[] = []
    const callback: ProgressCallback = {
      onStart: async () => {
        callbackEvents.push('start')
      },
      onComplete: async () => {
        callbackEvents.push('complete')
      },
      onInfo: async (message) => {
        infoMessages.push(message)
      },
      onWarning: async () => {},
      onError: async () => {},
    }

    const person = await scrapePerson(page, profileUrl, {
      callback,
      domExtractors: {
        summary: false,
        publications: false,
      },
      sections: {
        about: false,
        accomplishments: false,
        contacts: false,
        educations: false,
        experiences: false,
        interests: false,
        patents: false,
      },
      resume: { timeoutMs: 100 },
    })

    expect(person.linkedinUrl).toBe(profileUrl)
    expect(person.name).toBeUndefined()
    expect(person.about).toBeUndefined()
    expect(person.experiences).toEqual([])
    expect(person.educations).toEqual([])
    expect(person.contacts).toEqual([])

    expect(callbackEvents).toContain('start')
    expect(callbackEvents).toContain('complete')
    expect(infoMessages.some((message) => message.includes('Selected sections: none'))).toBe(true)
  })
})
