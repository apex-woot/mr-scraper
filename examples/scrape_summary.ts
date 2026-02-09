import { BrowserManager, getProfileSummary, loginWithCookie, loginWithCredentials, scrapePerson } from '../src'

async function runExample() {
  console.log('\n--- LinkedIn Profile Summary Scraper ---')

  const linkedinUrl = process.argv[2]?.trim() || prompt('Enter LinkedIn profile URL:', '')?.trim() || ''
  if (!linkedinUrl) {
    throw new Error('A LinkedIn profile URL is required.')
  }

  const isHeadless = process.argv.includes('--headless')
  const shouldPrint = process.argv.includes('--print')

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
      console.warn('No authentication found in .env. Profile scraping may be limited.')
    }

    const person = await scrapePerson(browser.page, linkedinUrl, {
      sections: {
        about: true,
        experiences: false,
        educations: false,
        patents: false,
        interests: false,
        accomplishments: false,
        contacts: false,
      },
    })

    const summary = getProfileSummary(person)

    if (shouldPrint) {
      console.log(`\n${JSON.stringify(summary, null, 2)}`)
      return
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `profile_summary_${timestamp}.json`
    await Bun.write(filename, JSON.stringify(summary, null, 2))
    console.log(`\nSaved profile summary to: ${filename}`)
  } finally {
    await browser.close()
  }
}

runExample().catch((error) => {
  console.error('Summary scrape failed:', error)
  process.exitCode = 1
})
