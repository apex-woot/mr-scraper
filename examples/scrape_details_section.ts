import { BrowserManager, loginWithCookie, loginWithCredentials } from '../src'
import { AccomplishmentPageExtractor } from '../src/extraction/page-extractors'
import { AccomplishmentParser } from '../src/extraction/parsers'
import { ExtractionPipeline } from '../src/extraction/pipeline'
import { AriaTextExtractor, RawTextExtractor, SemanticTextExtractor } from '../src/extraction/text-extractors'
import type { Accomplishment } from '../src/models'
import { getContactInfo } from '../src/scrapers/person/contact-info'
import { getExperiences } from '../src/scrapers/person/experiences'
import { getPatents } from '../src/scrapers/person/patents'

type DetailsSection = 'experience' | 'patents' | 'publications' | 'contact-info'

function parseDetailsUrl(input: string): {
  baseProfileUrl: string
  section: DetailsSection
} {
  const url = new URL(input)
  const path = url.pathname.replace(/\/+$/, '')

  const detailsMatch = path.match(
    /^\/in\/([^/]+)\/details\/(experience|patents|publications|publication|piblicaion|piblecation)$/,
  )
  if (detailsMatch?.[1] && detailsMatch[2]) {
    const rawSection = detailsMatch[2]
    const section: DetailsSection =
      rawSection === 'experience' || rawSection === 'patents' ? rawSection : 'publications'

    return {
      baseProfileUrl: `${url.protocol}//${url.host}/in/${detailsMatch[1]}/`,
      section,
    }
  }

  const contactMatch = path.match(/^\/in\/([^/]+)\/overlay\/contact-info$/)
  if (contactMatch?.[1]) {
    return {
      baseProfileUrl: `${url.protocol}//${url.host}/in/${contactMatch[1]}/`,
      section: 'contact-info',
    }
  }

  throw new Error(
    'URL must look like https://www.linkedin.com/in/<id>/details/experience/, /details/patents/, /details/publications/, or /overlay/contact-info/',
  )
}

async function getPublications(
  baseProfileUrl: string,
  page: InstanceType<typeof BrowserManager>['page'],
  includeRaw: boolean,
): Promise<Accomplishment[]> {
  const pipeline = new ExtractionPipeline<Accomplishment>({
    pageExtractor: new AccomplishmentPageExtractor({
      urlPath: 'publications',
      category: 'publication',
    }),
    textExtractors: [new AriaTextExtractor(), new SemanticTextExtractor(), new RawTextExtractor()],
    parser: new AccomplishmentParser(),
    includeRaw,
    confidenceThreshold: 0.25,
    captureHtmlOnFailure: true,
  })

  const result = await pipeline.extract({ page, baseUrl: baseProfileUrl })
  return result.items.filter((item) => item.category === 'publication')
}

async function runExample() {
  console.log('\n--- LinkedIn Details Section Scraper ---')
  const inputUrl =
    process.argv[2]?.trim() ||
    prompt(
      'Enter LinkedIn details URL (/details/experience, /details/patents, /details/publications, or /overlay/contact-info):',
      '',
    )?.trim() ||
    ''
  if (!inputUrl) {
    throw new Error('A LinkedIn details URL is required.')
  }

  const { baseProfileUrl, section } = parseDetailsUrl(inputUrl)
  const isHeadless = process.argv.includes('--headless')
  const shouldPrint = process.argv.includes('--print')
  const includeRaw = process.argv.includes('--raw')

  console.log(`\nInput details URL: ${inputUrl}`)
  console.log(`Profile URL: ${baseProfileUrl}`)
  console.log(`Section only: ${section}`)
  console.log(`Mode: ${isHeadless ? 'Headless' : 'Headed (Browser Visible)'}`)
  console.log(`Output: ${shouldPrint ? 'Print JSON to terminal' : 'Save to file'}`)

  const browser = new BrowserManager({
    headless: isHeadless,
    slowMo: isHeadless ? 0 : 50,
  })

  try {
    await browser.start()

    if (process.env.LINKEDIN_LI_AT_COOKIE) {
      console.log('Found li_at cookie in .env, logging in with cookie...')
      await loginWithCookie(browser.page, process.env.LINKEDIN_LI_AT_COOKIE)
    } else if (process.env.LINKEDIN_EMAIL && process.env.LINKEDIN_PASSWORD) {
      console.log('Found credentials in .env, logging in...')
      await loginWithCredentials(browser.page)
    } else {
      console.warn('No authentication found in .env. LinkedIn details pages may be blocked.')
    }

    if (section === 'experience') {
      const experiences = await getExperiences(browser.page, baseProfileUrl)
      const output = {
        inputUrl,
        section,
        count: experiences.length,
        experiences,
      }

      if (shouldPrint) {
        console.log(`\n${JSON.stringify(output, null, 2)}`)
        return
      }

      const filename = `details_experience_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      await Bun.write(filename, JSON.stringify(output, null, 2))
      console.log(`\nSaved ${experiences.length} experiences to: ${filename}`)
      return
    }

    if (section === 'patents') {
      const patents = await getPatents(browser.page, baseProfileUrl)
      const output = {
        inputUrl,
        section,
        count: patents.length,
        patents,
      }

      if (shouldPrint) {
        console.log(`\n${JSON.stringify(output, null, 2)}`)
        return
      }

      const filename = `details_patents_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      await Bun.write(filename, JSON.stringify(output, null, 2))
      console.log(`\nSaved ${patents.length} patents to: ${filename}`)
      return
    }

    if (section === 'publications') {
      const publications = await getPublications(baseProfileUrl, browser.page, includeRaw)
      const output = {
        inputUrl,
        section,
        count: publications.length,
        publications,
      }

      if (shouldPrint) {
        console.log(`\n${JSON.stringify(output, null, 2)}`)
        return
      }

      const filename = `details_publications_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      await Bun.write(filename, JSON.stringify(output, null, 2))
      console.log(`\nSaved ${publications.length} publications to: ${filename}`)
      return
    }

    const contacts = await getContactInfo(browser.page, baseProfileUrl)
    const output = {
      inputUrl,
      section,
      count: contacts.length,
      contacts,
    }

    if (shouldPrint) {
      console.log(`\n${JSON.stringify(output, null, 2)}`)
      return
    }

    const filename = `details_contact_info_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    await Bun.write(filename, JSON.stringify(output, null, 2))
    console.log(`\nSaved ${contacts.length} contacts to: ${filename}`)
  } finally {
    await browser.close()
  }
}

runExample().catch((error) => {
  console.error('Details scrape failed:', error)
  process.exitCode = 1
})
