import type { Page, Request } from 'playwright'
import { z } from 'zod'
import { isVoyagerApiUrl } from './voyager-utils'

export const VoyagerRequestSnapshotSchema = z.object({
  capturedAt: z.string(),
  method: z.string().min(1),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).default({}),
})

export type VoyagerRequestSnapshot = z.infer<typeof VoyagerRequestSnapshotSchema>

export interface VoyagerRequestRecorderOptions {
  matchers?: readonly string[]
  dedupe?: boolean
  maxRequests?: number
  includeHeaders?: readonly string[]
}

export interface WaitForVoyagerRequestOptions {
  timeoutMs?: number
}

export interface VoyagerRequestRecorder {
  start(): void
  stop(): void
  getRequests(): readonly VoyagerRequestSnapshot[]
  waitForFirstRequest(options?: WaitForVoyagerRequestOptions): Promise<VoyagerRequestSnapshot>
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

const DEFAULT_HEADER_ALLOWLIST = [
  'cookie',
  'csrf-token',
  'user-agent',
  'accept',
  'accept-language',
  'referer',
  'x-restli-protocol-version',
] as const

export function createVoyagerRequestRecorder(
  page: Page,
  options: VoyagerRequestRecorderOptions = {},
): VoyagerRequestRecorder {
  const matchers = options.matchers ?? ['/voyager/api/']
  const dedupe = options.dedupe ?? true
  const maxRequests = options.maxRequests ?? 200
  const includeHeaders = (options.includeHeaders ?? DEFAULT_HEADER_ALLOWLIST).map((h) => h.toLowerCase())

  let started = false
  const requests: VoyagerRequestSnapshot[] = []
  const seen = new Set<string>()
  const firstDeferred = createDeferred<VoyagerRequestSnapshot>()

  const handler = (request: Request): void => {
    const url = request.url()
    if (!isVoyagerApiUrl(url, matchers)) return

    const method = request.method()
    const signature = `${method} ${url}`
    if (dedupe && seen.has(signature)) return
    if (requests.length >= maxRequests) return

    const rawHeaders = lowerCaseHeaders(request.headers())
    const headers: Record<string, string> = {}
    for (const key of includeHeaders) {
      const value = rawHeaders[key]
      if (value) headers[key] = value
    }

    const snapshot = VoyagerRequestSnapshotSchema.parse({
      capturedAt: new Date().toISOString(),
      method,
      url,
      headers,
    })

    if (dedupe) seen.add(signature)
    requests.push(snapshot)
    firstDeferred.resolve(snapshot)
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

  const getRequests = (): readonly VoyagerRequestSnapshot[] => requests

  const waitForFirstRequest = async (
    waitOptions: WaitForVoyagerRequestOptions = {},
  ): Promise<VoyagerRequestSnapshot> => {
    const timeoutMs = waitOptions.timeoutMs ?? 15000
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<VoyagerRequestSnapshot>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Timed out waiting for a Voyager request after ${timeoutMs}ms`)),
        timeoutMs,
      )
    })

    try {
      return await Promise.race([firstDeferred.promise, timeoutPromise])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  return {
    start,
    stop,
    getRequests,
    waitForFirstRequest,
  }
}
