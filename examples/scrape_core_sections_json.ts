import {
  BrowserManager,
  getProfileSummary,
  loginWithCookie,
  loginWithCredentials,
  PERSON_CORE_SECTIONS_CONFIG,
  scrapePerson,
} from '../src'

async function runExample() {
  console.log('\n--- LinkedIn Core Sections JSON Scraper ---')

  const linkedinUrl = process.argv[2]?.trim() || prompt('Enter LinkedIn profile URL:', '')?.trim() || ''
  if (!linkedinUrl) {
    throw new Error('A LinkedIn profile URL is required.')
  }

  const isHeadless = process.argv.includes('--headless')

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
      console.warn('No authentication found in .env. LinkedIn scraping may be limited.')
    }

    const person = await scrapePerson(browser.page, linkedinUrl, {
      domExtractors: PERSON_CORE_SECTIONS_CONFIG.domExtractors,
    })

    const output = {
      linkedinUrl: person.linkedinUrl,
      summary: getProfileSummary(person),
      about: person.about ?? null,
      contactInfo: person.contacts,
      education: person.educations,
      experience: person.experiences,
      patents: person.patents,
      publications: person.accomplishments.filter((item) => item.category === 'publication'),
    }

    console.log(JSON.stringify(output, null, 2))
  } finally {
    await browser.close()
  }
}

runExample().catch((error) => {
  console.error('Core sections scrape failed:', error)
  process.exitCode = 1
})
