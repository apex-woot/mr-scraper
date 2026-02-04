import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { isLoggedIn } from '../src/auth'
import { BrowserManager } from '../src/browser'

// Skip integration tests in CI as they require network access and are slow
const isCI = !!process.env.CI
const describeIntegration = isCI ? describe.skip : describe

describeIntegration('Authentication', () => {
  let browserManager: BrowserManager

  beforeAll(async () => {
    browserManager = new BrowserManager({ headless: true })
    await browserManager.start()
  })

  afterAll(async () => {
    await browserManager.close()
  })

  test(
    'isLoggedIn returns false on public pages',
    async () => {
      const page = browserManager.page
      await page.goto('https://www.google.com', { timeout: 10000 })
      const loggedIn = await isLoggedIn(page)
      expect(loggedIn).toBe(false)
    },
    { timeout: 15000 },
  )

  test(
    'isLoggedIn returns false on LinkedIn login page',
    async () => {
      const page = browserManager.page
      await page.goto('https://www.linkedin.com/login', { timeout: 10000 })
      const loggedIn = await isLoggedIn(page)
      expect(loggedIn).toBe(false)
    },
    { timeout: 15000 },
  )
})
