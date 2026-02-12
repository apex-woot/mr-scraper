import { BrowserManager, loginWithCookie, scrapeJob, scrapeJobSearchResults } from '../src'

type CliOptions = {
  headless: boolean
  slowMo: number
  searchUrl: string
  maxJobs: number
  scrollPasses: number
}

const DEFAULT_SEARCH_URL = 'https://www.linkedin.com/jobs/search/?currentJobId=1234567890&origin=JOBS_HOME_JYMBII'

function parseCliArgs(argv: string[]): CliOptions {
  const headless = argv.includes('--headless')

  const searchUrl = getArgValue(argv, '--search-url') ?? DEFAULT_SEARCH_URL

  const maxJobs = parseInt(getArgValue(argv, '--max') ?? '20', 10)
  const scrollPasses = parseInt(getArgValue(argv, '--scroll') ?? '15', 10)

  const slowMoRaw = getArgValue(argv, '--slowmo')
  const slowMo = slowMoRaw ? parseInt(slowMoRaw, 10) : headless ? 0 : 75

  return {
    headless,
    slowMo: Number.isFinite(slowMo) ? slowMo : 0,
    searchUrl,
    maxJobs: clampInt(maxJobs, 1, 200),
    scrollPasses: clampInt(scrollPasses, 1, 60),
  }
}

function getArgValue(argv: string[], key: string): string | null {
  const match = argv.find((a) => a === key || a.startsWith(`${key}=`))
  if (!match) return null

  if (match.startsWith(`${key}=`)) {
    return match.slice(`${key}=`.length)
  }

  const idx = argv.indexOf(key)
  if (idx >= 0) return argv[idx + 1] ?? null
  return null
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  const v = Math.trunc(value)
  if (v < min) return min
  if (v > max) return max
  return v
}

// NOTE: we intentionally rely on stable invariants (data-job-id, /jobs/view/ links)
// rather than LinkedIn's frequently changing class names. See `scrapeJobSearchResults`.

async function run(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2))

  const cookie = process.env.LINKEDIN_LI_AT_COOKIE
  if (!cookie) {
    throw new Error('Missing LINKEDIN_LI_AT_COOKIE env var (LinkedIn li_at cookie value).')
  }

  const browser = new BrowserManager({
    headless: options.headless,
    slowMo: options.slowMo,
  })

  await browser.start()

  try {
    await loginWithCookie(browser.page, cookie)

    const searchPage = browser.page
    const jobPage = await browser.newPage()

    const entries = await scrapeJobSearchResults(searchPage, options.searchUrl, {
      maxJobs: options.maxJobs,
      scrollPasses: options.scrollPasses,
      requireLogin: true,
    })

    const jobUrls = entries.map((e) => e.linkedinUrl)

    const jobs = []
    for (const url of jobUrls) {
      const job = await scrapeJob(jobPage, url, {
        requireLogin: true,
      })
      jobs.push(job)
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          searchUrl: options.searchUrl,
          scrapedAt: new Date().toISOString(),
          jobs,
        },
        null,
        2,
      )}\n`,
    )
  } finally {
    await browser.close()
  }
}

run().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
