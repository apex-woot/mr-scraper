import { z } from 'zod'

export const VoyagerReplaySessionSchema = z.object({
  version: z.number().int().positive().default(1),
  capturedAt: z.string(),
  voyagerUrl: z.string().url(),
  cookieSource: z.enum(['request', 'context']).optional(),
  cookieHeader: z.string().min(1),
  csrfToken: z.string().min(1),
  userAgent: z.string().min(1),
  restliProtocolVersion: z.string().min(1).default('2.0.0'),
})

export type VoyagerReplaySession = z.infer<typeof VoyagerReplaySessionSchema>

export function maskSecret(value: string, prefix: number = 4, suffix: number = 4): string {
  if (!value) return ''
  if (value.length <= prefix + suffix) return '********'
  return `${value.slice(0, prefix)}...${value.slice(-suffix)}`
}
