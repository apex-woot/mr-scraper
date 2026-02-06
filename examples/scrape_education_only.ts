import { BrowserManager, loginWithCookie, loginWithCredentials } from '../src'
import { getEducations } from '../src/scrapers/person/educations'

function parseLinkedInEducationInput(input: string): {
  inputUrl: string
  baseProfileUrl: string
  detailsEducationUrl: string
  isProfileUrl: boolean
} {
  const url = new URL(input)
  const path = url.pathname.replace(/\/+$/, '')

  const profileMatch = path.match(/^\/in\/([^/]+)$/)
  if (profileMatch?.[1]) {
    const baseProfileUrl = `${url.protocol}//${url.host}/in/${profileMatch[1]}/`
    return {
      inputUrl: input,
      baseProfileUrl,
      detailsEducationUrl: `${baseProfileUrl}details/education/`,
      isProfileUrl: true,
    }
  }

  const detailsMatch = path.match(/^\/in\/([^/]+)\/details\/education$/)
  if (detailsMatch?.[1]) {
    const baseProfileUrl = `${url.protocol}//${url.host}/in/${detailsMatch[1]}/`
    return {
      inputUrl: input,
      baseProfileUrl,
      detailsEducationUrl: `${baseProfileUrl}details/education/`,
      isProfileUrl: false,
    }
  }

  throw new Error(
    'URL must look like https://www.linkedin.com/in/<id>/ or https://www.linkedin.com/in/<id>/details/education/',
  )
}

async function runExample() {
  const inputUrl = process.argv[2]?.trim() || prompt('Enter LinkedIn profile or details URL:', '')?.trim() || ''
  if (!inputUrl) {
    throw new Error('A LinkedIn profile or education details URL is required.')
  }
  const isHeadless = process.argv.includes('--headless')

  const parsed = parseLinkedInEducationInput(inputUrl)

  console.log('\n--- LinkedIn Education-Only Extractor ---')
  console.log(`Input URL: ${parsed.inputUrl}`)
  console.log(`Profile URL: ${parsed.baseProfileUrl}`)
  console.log(`Education details URL: ${parsed.detailsEducationUrl}`)
  console.log(`Mode: ${isHeadless ? 'Headless' : 'Headed (Browser Visible)'}`)

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

    if (parsed.isProfileUrl) {
      console.log(`Input is a profile URL, navigating to: ${parsed.detailsEducationUrl}`)
      await browser.page.goto(parsed.detailsEducationUrl, { waitUntil: 'domcontentloaded' })
    } else {
      console.log('Input is already an education details URL, navigating directly...')
      await browser.page.goto(parsed.detailsEducationUrl, { waitUntil: 'domcontentloaded' })
    }

    const educations = await getEducations(browser.page, parsed.baseProfileUrl)
    console.log(JSON.stringify(educations, null, 2))
  } finally {
    await browser.close()
  }
}

runExample().catch((error) => {
  console.error('Education-only scrape failed:', error)
  process.exitCode = 1
})
