import { BrowserManager, loginWithCookie, loginWithCredentials } from '../src'
import { getExperiences } from '../src/scrapers/person/experiences'
import { getPatents } from '../src/scrapers/person/patents'

type DetailsSection = 'experience' | 'patents'

function parseDetailsUrl(input: string): {
  baseProfileUrl: string
  section: DetailsSection
} {
  const url = new URL(input)
  const path = url.pathname.replace(/\/+$/, '')

  const match = path.match(/^\/in\/([^/]+)\/details\/(experience|patents)$/)
  if (!match?.[1] || !match[2]) {
    throw new Error('URL must look like https://www.linkedin.com/in/<id>/details/experience/ or /details/patents/')
  }

  return {
    baseProfileUrl: `${url.protocol}//${url.host}/in/${match[1]}/`,
    section: match[2] as DetailsSection,
  }
}

async function runExample() {
  console.log('\n--- LinkedIn Details Section Scraper ---')
  const inputUrl =
    process.argv[2]?.trim() ||
    prompt('Enter LinkedIn details URL (/details/experience or /details/patents):', '')?.trim() ||
    ''
  if (!inputUrl) {
    throw new Error('A LinkedIn details URL is required.')
  }

  const { baseProfileUrl, section } = parseDetailsUrl(inputUrl)
  const isHeadless = process.argv.includes('--headless')
  const shouldPrint = process.argv.includes('--print')

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
  } finally {
    await browser.close()
  }
}

runExample().catch((error) => {
  console.error('Details scrape failed:', error)
  process.exitCode = 1
})
