import type { Page, Request } from 'playwright'
import { log } from '../utils/logger'
import { type VoyagerReplaySession, VoyagerReplaySessionSchema } from './voyager-session'
import { buildCookieHeaderFromCookies, csrfMatchesJsession, isVoyagerApiUrl } from './voyager-utils'

export interface VoyagerSessionRecorderOptions {
  matchers?: readonly string[]
  autoStop?: boolean
  redactLogs?: boolean
  cookieNames?: readonly string[]
  cookieUrl?: string
}

export interface WaitForVoyagerSessionOptions {
  timeoutMs?: number
}

export interface VoyagerSessionRecorder {
  start(): void
  stop(): void
  getSession(): VoyagerReplaySession | undefined
  waitForSession(options?: WaitForVoyagerSessionOptions): Promise<VoyagerReplaySession>
}

function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
} {
  let resolveFn: ((value: T) => void) | undefined
  let rejectFn: ((error: Error) => void) | undefined

  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve
    rejectFn = reject
  })

  return {
    promise,
    resolve: (value: T) => resolveFn?.(value),
    reject: (error: Error) => rejectFn?.(error),
  }
}

function lowerCaseHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) out[k.toLowerCase()] = v
  return out
}

export function createVoyagerSessionRecorder(
  page: Page,
  options: VoyagerSessionRecorderOptions = {},
): VoyagerSessionRecorder {
  const matchers = options.matchers ?? ['/voyager/api/']
  const autoStop = options.autoStop ?? true
  const redactLogs = options.redactLogs ?? true
  const cookieNames = options.cookieNames ?? ['li_at', 'JSESSIONID']
  const cookieUrl = options.cookieUrl ?? 'https://www.linkedin.com'

  let started = false
  let captured: VoyagerReplaySession | undefined
  const deferred = createDeferred<VoyagerReplaySession>()

  let capturing = false

  const handler = async (request: Request): Promise<void> => {
    if (captured) return
    if (capturing) return

    const url = request.url()
    if (!isVoyagerApiUrl(url, matchers)) return

    const headers = lowerCaseHeaders(request.headers())
    const csrfToken = headers['csrf-token']
    const userAgent = headers['user-agent']
    const restliProtocolVersion = headers['x-restli-protocol-version']

    if (!csrfToken || !userAgent) return

    capturing = true
    try {
      const cookieHeaderFromRequest = headers.cookie

      // Playwright may not expose the Cookie header for all requests.
      // Fallback to the BrowserContext cookie jar (more reliable).
      const cookieHeaderFromContext = cookieHeaderFromRequest
        ? undefined
        : buildCookieHeaderFromCookies(
            (await page.context().cookies(cookieUrl)).map((c) => ({ name: c.name, value: c.value })),
            cookieNames,
          )

      const cookieHeader = cookieHeaderFromRequest ?? cookieHeaderFromContext
      if (!cookieHeader) return

      const session = VoyagerReplaySessionSchema.parse({
        version: 1,
        capturedAt: new Date().toISOString(),
        voyagerUrl: url,
        cookieSource: cookieHeaderFromRequest ? 'request' : 'context',
        cookieHeader,
        csrfToken,
        userAgent,
        restliProtocolVersion: restliProtocolVersion ?? '2.0.0',
      })

      const csrfOk = csrfMatchesJsession(session.csrfToken, session.cookieHeader)
      if (csrfOk === false) {
        const note = redactLogs
          ? 'csrf-token does not appear to match JSESSIONID (redacted)'
          : `csrf-token does not appear to match JSESSIONID for ${session.voyagerUrl}`
        log.warning(`Voyager session capture warning: ${note}`)
      }

      captured = session
      deferred.resolve(session)

      if (autoStop) stop()
    } finally {
      capturing = false
    }
  }

  const start = (): void => {
    if (started) return
    started = true
    page.on('request', handler)
  }

  const stop = (): void => {
    if (!started) return
    started = false
    page.off('request', handler)
  }

  const getSession = (): VoyagerReplaySession | undefined => captured

  const waitForSession = async (waitOptions: WaitForVoyagerSessionOptions = {}): Promise<VoyagerReplaySession> => {
    if (captured) return captured

    const timeoutMs = waitOptions.timeoutMs ?? 45000
    let timer: ReturnType<typeof setTimeout> | undefined

    const timeoutPromise = new Promise<VoyagerReplaySession>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for a Voyager API request after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    try {
      return await Promise.race([deferred.promise, timeoutPromise])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  return {
    start,
    stop,
    getSession,
    waitForSession,
  }
}

export async function captureVoyagerSession(
  page: Page,
  options: VoyagerSessionRecorderOptions & WaitForVoyagerSessionOptions = {},
): Promise<VoyagerReplaySession> {
  const recorder = createVoyagerSessionRecorder(page, options)
  recorder.start()
  try {
    return await recorder.waitForSession({ timeoutMs: options.timeoutMs })
  } finally {
    recorder.stop()
  }
}
