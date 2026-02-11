import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { BrowserManager } from '../src/browser'
import { extractTopCardFromPage } from '../src/scrapers/person/top-card'

async function loadFixture(name: string): Promise<string> {
  return await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
}

const canRunPlaywright = existsSync(chromium.executablePath())
const describeTopCard = canRunPlaywright ? describe : describe.skip

describeTopCard('Top card extractor', () => {
  let browserManager: BrowserManager

  beforeAll(async () => {
    browserManager = new BrowserManager({ headless: true })
    await browserManager.start()
  })

  afterAll(async () => {
    await browserManager.close()
  })

  test('extracts name/headline/origin for sample person A', async () => {
    const page = browserManager.page
    const html = await loadFixture('top-card-person-a.html')

    await page.setContent(html)
    const result = await extractTopCardFromPage(page)

    expect(result).toEqual({
      name: 'Jordan Vale',
      headline: 'Product Research Lead',
      currentPosition: 'Product Research Lead',
      origin: 'Riverton, Colorado, United States',
    })
  })

  test('extracts name/headline/origin for sample person B', async () => {
    const page = browserManager.page
    const html = await loadFixture('top-card-person-b.html')

    await page.setContent(html)
    const result = await extractTopCardFromPage(page)

    expect(result).toEqual({
      name: 'Taylor Quinn',
      headline: 'builder. writer. operator.',
      currentPosition: 'builder. writer. operator.',
      origin: 'Harbor City, Florida, United States',
    })
  })

  test('returns null headline and origin when missing', async () => {
    const page = browserManager.page
    await page.setContent(`
      <main>
        <section class="artdeco-card" data-member-id="1">
          <h1 class="inline t-24">Alex Doe</h1>
        </section>
      </main>
    `)

    const result = await extractTopCardFromPage(page)

    expect(result).toEqual({
      name: 'Alex Doe',
      headline: null,
      currentPosition: null,
      origin: null,
    })
  })

  test('strips Contact info text from origin line', async () => {
    const page = browserManager.page
    await page.setContent(`
      <main>
        <section class="artdeco-card" data-member-id="1">
          <h1 class="inline t-24">Alex Doe</h1>
          <div class="text-body-medium break-words">Founder</div>
          <div class="mt2">
            <span class="text-body-small inline t-black--light break-words">
              Austin, Texas, United States Contact info
            </span>
          </div>
        </section>
      </main>
    `)

    const result = await extractTopCardFromPage(page)

    expect(result).toEqual({
      name: 'Alex Doe',
      headline: 'Founder',
      currentPosition: 'Founder',
      origin: 'Austin, Texas, United States',
    })
  })

  test('prefers the top-card section that contains an h1 name', async () => {
    const page = browserManager.page
    await page.setContent(`
      <main>
        <section class="artdeco-card" data-member-id="junk">
          <button>More</button>
          <button>Message</button>
        </section>
        <section class="artdeco-card" data-member-id="person-1">
          <h1 class="inline t-24">Sam Example</h1>
          <div class="text-body-medium break-words">Staff Engineer</div>
          <div class="mt2">
            <span class="text-body-small inline t-black--light break-words">
              Seattle, Washington, United States
            </span>
          </div>
        </section>
      </main>
    `)

    const result = await extractTopCardFromPage(page)

    expect(result).toEqual({
      name: 'Sam Example',
      headline: 'Staff Engineer',
      currentPosition: 'Staff Engineer',
      origin: 'Seattle, Washington, United States',
    })
  })

  test('prefers semantic text when aria-hidden spans are mostly action noise', async () => {
    const page = browserManager.page
    await page.setContent(`
      <main>
        <section class="artdeco-card" data-member-id="person-2">
          <div>
            <span aria-hidden="true">Send profile in a message</span>
            <span aria-hidden="true">Save to PDF</span>
            <span aria-hidden="true">Follow</span>
            <span aria-hidden="true">Report / Block</span>
          </div>
          <h1 class="inline t-24">Casey Example</h1>
          <div class="text-body-medium break-words">Partner at Example Company LLP</div>
          <div class="mt2">
            <span class="text-body-small inline t-black--light break-words">
              Park City, Utah, United States
            </span>
            <a href="#" class="link-without-visited-state">Contact info</a>
          </div>
        </section>
      </main>
    `)

    const result = await extractTopCardFromPage(page)

    expect(result).toEqual({
      name: 'Casey Example',
      headline: 'Partner at Example Company LLP',
      currentPosition: 'Partner at Example Company LLP',
      origin: 'Park City, Utah, United States',
    })
  })
})
