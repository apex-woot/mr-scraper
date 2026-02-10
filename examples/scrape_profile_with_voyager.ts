import fs from 'node:fs/promises'
import path from 'node:path'
import {
  BrowserManager,
  extractCookieValue,
  loginWithCookie,
  loginWithCredentials,
  maskSecret,
  scrapePersonWithVoyagerCapture,
} from '../src'

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

async function runExample() {
  console.log('\n--- LinkedIn Profile Scraper (with Voyager Capture) ---')

  const linkedinUrl = process.argv[2]?.trim() || prompt('Enter LinkedIn profile URL:', '')?.trim() || ''
  if (!linkedinUrl) throw new Error('A LinkedIn profile URL is required.')

  const isHeadless = process.argv.includes('--headless')
  const outDir = 'sessions'

  const browser = new BrowserManager({
    headless: isHeadless,
    slowMo: isHeadless ? 0 : 50,
  })

  try {
    await browser.start()

    if (process.env.LINKEDIN_LI_AT_COOKIE) {
      console.log('Found li_at cookie in env, logging in with cookie...')
      await loginWithCookie(browser.page, process.env.LINKEDIN_LI_AT_COOKIE)
    } else if (process.env.LINKEDIN_EMAIL && process.env.LINKEDIN_PASSWORD) {
      console.log('Found credentials in env, logging in...')
      await loginWithCredentials(browser.page)
    } else {
      console.warn('No authentication found in env. Profile scraping may be limited.')
    }

    const result = await scrapePersonWithVoyagerCapture(browser.page, linkedinUrl, {
      voyagerCapture: {
        session: { enabled: true, timeoutMs: 45000, redactLogs: true },
        requests: { enabled: true, dedupe: true, maxRequests: 200 },
      },
    })

    const personPath = path.join(outDir, 'person.json')
    await writeJsonFile(personPath, result.person)
    console.log(`Wrote person scrape to: ${personPath}`)

    if (result.voyagerSession) {
      const sessionPath = path.join(outDir, 'voyager-session.json')
      await writeJsonFile(sessionPath, result.voyagerSession)
      console.log(`Wrote Voyager session to: ${sessionPath}`)
    } else {
      console.log('Voyager session was not captured (no cookie/csrf/user-agent bundle found).')
    }

    if (result.voyagerRequests) {
      const requestsPath = path.join(outDir, 'voyager-requests.json')
      await writeJsonFile(requestsPath, result.voyagerRequests)
      console.log(`Wrote Voyager requests to: ${requestsPath}`)
    }

    if (result.voyagerSession) {
      const liAt = extractCookieValue(result.voyagerSession.cookieHeader, 'li_at')
      const jsession = extractCookieValue(result.voyagerSession.cookieHeader, 'JSESSIONID')
      console.log(`csrfToken: ${maskSecret(result.voyagerSession.csrfToken)}`)
      console.log(`li_at: ${liAt ? maskSecret(liAt) : '(missing)'}`)
      console.log(`JSESSIONID: ${jsession ? maskSecret(jsession) : '(missing)'}`)
      console.log(`userAgent: ${result.voyagerSession.userAgent}`)
    }
  } finally {
    await browser.close()
  }
}

runExample().catch((error) => {
  console.error('Scrape with Voyager capture failed:', error)
  process.exitCode = 1
})
