import { access, readFile, writeFile } from 'node:fs/promises'
import { stdin as input, stdout as output } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { AuthenticationError, BrowserManager, isLoggedIn, loginWithCredentials } from '../src'

const ENV_FILE = new URL('../.env', import.meta.url)
const COOKIE_KEY = 'LINKEDIN_LI_AT_COOKIE'
const VERIFICATION_TIMEOUT_MS = 5 * 60 * 1000
const VERIFICATION_URL_MARKERS = ['/checkpoint', '/challenge', '/uas/consumer-email-challenge']
const VERIFICATION_INPUT_SELECTORS = [
  'input[name="pin"]',
  'input[id*="verification_pin"]',
  'input[name*="verification"]',
  'input[autocomplete="one-time-code"]',
  'input[inputmode="numeric"]',
]

function maskSecret(secret: string): string {
  if (secret.length <= 8) return '********'
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`
}

async function readEnvFile(): Promise<string> {
  try {
    await access(ENV_FILE)
    return await readFile(ENV_FILE, 'utf8')
  } catch {
    return ''
  }
}

function upsertEnvValue(existing: string, key: string, value: string): string {
  const lines = existing.length > 0 ? existing.split(/\r?\n/) : []
  let replaced = false

  const nextLines = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      replaced = true
      return `${key}=${value}`
    }

    return line
  })

  if (!replaced) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== '') {
      nextLines.push('')
    }
    nextLines.push(`${key}=${value}`)
  }

  return `${nextLines.join('\n')}\n`
}

async function isVerificationFlow(page: InstanceType<typeof BrowserManager>['page']): Promise<boolean> {
  const currentUrl = page.url()
  if (VERIFICATION_URL_MARKERS.some((marker) => currentUrl.includes(marker))) {
    return true
  }

  for (const selector of VERIFICATION_INPUT_SELECTORS) {
    if ((await page.locator(selector).count()) > 0) {
      return true
    }
  }

  return false
}

async function promptForVerificationCode(timeoutMs: number): Promise<string> {
  const rl = createInterface({ input, output })
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new AuthenticationError('Timed out waiting for verification code after 5 minutes. Closing browser session.'),
      )
    }, timeoutMs)
  })

  try {
    const code = await Promise.race([
      rl.question('LinkedIn verification required. Enter the code from LinkedIn (waiting up to 5 minutes): '),
      timeoutPromise,
    ])

    const trimmed = code.trim()
    if (!trimmed) {
      throw new AuthenticationError('Verification code was empty.')
    }

    return trimmed
  } finally {
    if (timer) clearTimeout(timer)
    rl.close()
  }
}

async function submitVerificationCode(page: InstanceType<typeof BrowserManager>['page'], code: string): Promise<void> {
  let selectedInput: string | null = null

  for (const selector of VERIFICATION_INPUT_SELECTORS) {
    const locator = page.locator(selector).first()
    if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
      selectedInput = selector
      break
    }
  }

  if (!selectedInput) {
    throw new AuthenticationError('Could not find verification code input field on the page.')
  }

  await page.fill(selectedInput, code)

  const submitButton = page
    .locator('button[type="submit"], button:has-text("Verify"), button:has-text("Submit"), button:has-text("Continue")')
    .first()

  if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await submitButton.click()
  } else {
    await page.keyboard.press('Enter')
  }

  await page.waitForTimeout(1500)
}

async function waitForLoginConfirmation(
  page: InstanceType<typeof BrowserManager>['page'],
  timeoutMs: number,
): Promise<boolean> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await isLoggedIn(page)) return true
    await page.waitForTimeout(1000)
  }
  return false
}

async function runExample() {
  const isHeadless = process.argv.includes('--headless')

  if (!process.env.LINKEDIN_EMAIL || !process.env.LINKEDIN_PASSWORD) {
    throw new AuthenticationError(
      'Missing LINKEDIN_EMAIL or LINKEDIN_PASSWORD. Set both values in your environment before running this script.',
    )
  }

  const browser = new BrowserManager({
    headless: isHeadless,
    slowMo: isHeadless ? 0 : 100,
  })

  try {
    await browser.start()

    try {
      await loginWithCredentials(browser.page, {
        email: process.env.LINKEDIN_EMAIL,
        password: process.env.LINKEDIN_PASSWORD,
      })
    } catch (error) {
      if (!(await isVerificationFlow(browser.page))) {
        throw error
      }

      const code = await promptForVerificationCode(VERIFICATION_TIMEOUT_MS)
      await submitVerificationCode(browser.page, code)

      if (!(await waitForLoginConfirmation(browser.page, 30000))) {
        throw new AuthenticationError('Verification code was submitted, but login could not be confirmed.')
      }
    }

    await browser.page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    const cookies = await browser.context.cookies('https://www.linkedin.com')
    const liAtCookie = cookies.find((cookie) => cookie.name === 'li_at')

    if (!liAtCookie?.value) {
      throw new AuthenticationError('Login completed, but no li_at cookie was found in the browser context.')
    }

    const envContents = await readEnvFile()
    const nextContents = upsertEnvValue(envContents, COOKIE_KEY, liAtCookie.value)
    await writeFile(ENV_FILE, nextContents, 'utf8')

    console.log(`Saved ${COOKIE_KEY} to .env (${maskSecret(liAtCookie.value)})`)
  } finally {
    await browser.close()
  }
}

runExample().catch((error) => {
  console.error('Saving LinkedIn li_at cookie failed:', error)
  process.exitCode = 1
})
