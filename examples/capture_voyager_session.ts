import fs from 'node:fs/promises'
import path from 'node:path'
import {
  BrowserManager,
  createVoyagerSessionRecorder,
  extractCookieValue,
  loginWithCookie,
  loginWithCredentials,
  maskSecret,
  waitForManualLogin,
} from '../src'

function readFlagValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name)
  if (idx === -1) return undefined
  return args[idx + 1]
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name)
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

async function run() {
  const args = process.argv.slice(2)
  const targetUrl =
    args[0]?.trim() ||
    prompt('Enter a LinkedIn URL to visit (e.g. https://www.linkedin.com/in/sample-user/):', '')?.trim() ||
    ''

  if (!targetUrl) throw new Error('A LinkedIn URL is required.')

  const isHeadless = hasFlag(args, '--headless')
  const outPath = readFlagValue(args, '--out')?.trim() || 'sessions/voyager-session.json'
  const timeoutMs = Number(readFlagValue(args, '--timeout') ?? '45000')
  const redactLogs = !hasFlag(args, '--no-redact')

  const browser = new BrowserManager({
    headless: isHeadless,
    slowMo: isHeadless ? 0 : 50,
  })

  try {
    await browser.start()

    if (process.env.LINKEDIN_LI_AT_COOKIE) {
      console.log('Authenticating with li_at cookie from env...')
      await loginWithCookie(browser.page, process.env.LINKEDIN_LI_AT_COOKIE)
    } else if (process.env.LINKEDIN_EMAIL && process.env.LINKEDIN_PASSWORD) {
      console.log('Authenticating with credentials from env...')
      await loginWithCredentials(browser.page)
    } else {
      console.log('No env auth found. Opening LinkedIn login for manual sign-in...')
      await browser.page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' })
      await waitForManualLogin(browser.page)
    }

    const recorder = createVoyagerSessionRecorder(browser.page, {
      matchers: ['/voyager/api/'],
      autoStop: true,
      redactLogs,
    })

    recorder.start()
    await browser.page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })

    const session = await recorder.waitForSession({ timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 45000 })
    await writeJsonFile(outPath, session)

    const liAt = extractCookieValue(session.cookieHeader, 'li_at')
    const jsession = extractCookieValue(session.cookieHeader, 'JSESSIONID')

    console.log(`Captured Voyager request: ${session.voyagerUrl}`)
    console.log(`Wrote replay session to: ${outPath}`)
    console.log(`csrfToken: ${maskSecret(session.csrfToken)}`)
    console.log(`li_at: ${liAt ? maskSecret(liAt) : '(missing)'}`)
    console.log(`JSESSIONID: ${jsession ? maskSecret(jsession) : '(missing)'}`)
    console.log(`userAgent: ${session.userAgent}`)
  } finally {
    await browser.close()
  }
}

run().catch((error) => {
  console.error('Voyager session capture failed:', error)
  process.exitCode = 1
})
